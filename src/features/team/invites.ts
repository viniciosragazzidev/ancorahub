import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireCanCreateRole, type CreatableTeamRole } from "@/shared/auth/team-permissions";
import { getDatabase, schema } from "@/shared/db";

const inviteInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  role: z.enum(["manager", "broker"]),
  branchId: z.string().uuid(),
});

function digest(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function createTeamInvite(rawInput: unknown) {
  const input = inviteInput.parse(rawInput);
  const context = requireCanCreateRole(await getRequiredTenantContext(), input.role);
  const db = getDatabase();
  const [branch] = await db.select().from(schema.branches).where(and(eq(schema.branches.id, input.branchId), eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active"))).limit(1);
  if (!branch) throw new Error("A filial selecionada não pertence ao tenant ativo ou está inativa.");
  const [existing] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, input.email)).limit(1);
  if (existing) throw new Error("Já existe uma identidade com este e-mail.");
  const userId = randomUUID();
  const token = randomBytes(32).toString("hex");
  await db.insert(schema.user).values({ id: userId, name: input.name, email: input.email, emailVerified: false, active: false, status: "pending" });
  await db.insert(schema.tenantMemberships).values({ id: randomUUID(), tenantId: context.tenantId, userId, branchId: input.branchId, role: input.role, status: "active" });
  await db.insert(schema.invites).values({ id: randomUUID(), userId, tokenHash: digest(token), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), invitedBy: context.userId });
  return { token, role: input.role as CreatableTeamRole };
}

export async function acceptTeamInvite(token: string, password: string) {
  const validatedToken = z.string().regex(/^[a-f0-9]{64}$/).parse(token);
  const validatedPassword = z.string().min(8).max(128).parse(password);
  const db = getDatabase();
  const [invite] = await db.select().from(schema.invites).where(eq(schema.invites.tokenHash, digest(validatedToken))).limit(1);
  if (!invite || invite.usedAt || invite.expiresAt <= new Date()) throw new Error("Convite inválido ou expirado.");
  const [pendingUser] = await db.select().from(schema.user).where(and(eq(schema.user.id, invite.userId), eq(schema.user.status, "pending"))).limit(1);
  if (!pendingUser) throw new Error("O acesso convidado não está pendente.");
  const { hashPassword } = await import("better-auth/crypto");
  await db.insert(schema.account).values({ id: randomUUID(), userId: pendingUser.id, providerId: "credential", accountId: pendingUser.id, password: await hashPassword(validatedPassword) });
  await db.update(schema.user).set({ active: true, status: "active", emailVerified: true, updatedAt: new Date() }).where(eq(schema.user.id, pendingUser.id));
  await db.update(schema.invites).set({ usedAt: new Date() }).where(eq(schema.invites.id, invite.id));
}

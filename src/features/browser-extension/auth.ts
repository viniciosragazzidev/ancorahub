import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AuthorizationError, AuthenticationError } from "@/shared/auth/errors";
import type { ExtensionSession } from "./schemas";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function createExtensionAuthorizationCode() {
  const context = await getRequiredTenantContext();
  if (!["broker", "manager", "director"].includes(context.role)) throw new AuthorizationError("Perfil não autorizado para a extensão.");
  const rawCode = randomBytes(32).toString("base64url");
  const now = new Date();
  await getDatabase().insert(schema.extensionAuthCodes).values({
    id: randomUUID(), codeHash: hash(rawCode), userId: context.userId, tenantId: context.tenantId,
    expiresAt: new Date(now.getTime() + 5 * 60_000), createdAt: now,
  });
  return rawCode;
}

export async function authenticateExtensionRequest(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new AuthenticationError("Sessão da extensão ausente.");
  const now = new Date();
  const [session] = await getDatabase().select().from(schema.extensionSessions).where(and(
    eq(schema.extensionSessions.tokenHash, hash(token)), isNull(schema.extensionSessions.revokedAt), gt(schema.extensionSessions.expiresAt, now),
  )).limit(1);
  if (!session) throw new AuthenticationError("Sessão da extensão expirada ou revogada.");
  await getDatabase().update(schema.extensionSessions).set({ lastSeenAt: now }).where(eq(schema.extensionSessions.id, session.id));
  return { ...session, permissions: Array.isArray(session.permissions) ? session.permissions.filter((value): value is string => typeof value === "string") : [] };
}

export async function exchangeExtensionCode(input: { code: string; deviceId: string; extensionVersion: string }) {
  const now = new Date();
  const db = getDatabase();
  const [grant] = await db.select().from(schema.extensionAuthCodes).where(and(eq(schema.extensionAuthCodes.codeHash, hash(input.code)), isNull(schema.extensionAuthCodes.usedAt), gt(schema.extensionAuthCodes.expiresAt, now))).limit(1);
  if (!grant) throw new AuthenticationError("Código de autorização inválido ou expirado.");
  const rawToken = randomBytes(48).toString("base64url");
  const sessionId = randomUUID();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60_000);
  await db.transaction(async (tx) => {
    await tx.update(schema.extensionAuthCodes).set({ usedAt: now }).where(and(eq(schema.extensionAuthCodes.id, grant.id), isNull(schema.extensionAuthCodes.usedAt)));
    await tx.insert(schema.extensionSessions).values({ id: sessionId, tokenHash: hash(rawToken), userId: grant.userId, tenantId: grant.tenantId, deviceId: input.deviceId, extensionVersion: input.extensionVersion, permissions: ["VIEW_LEAD", "CHANGE_STATUS", "REGISTER_FEEDBACK", "CREATE_TASK", "GENERATE_REPLY"], expiresAt, lastSeenAt: now, createdAt: now });
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: grant.userId, entidade: "extension_session", entidadeId: sessionId, acao: "extension.session.created" });
  });
  return { token: rawToken, session: { userId: grant.userId, tenantId: grant.tenantId, deviceId: input.deviceId, sessionId, expiresAt: expiresAt.toISOString(), permissions: ["VIEW_LEAD", "CHANGE_STATUS", "REGISTER_FEEDBACK", "CREATE_TASK", "GENERATE_REPLY"] } satisfies ExtensionSession };
}

export async function revokeExtensionSession(request: Request) {
  const session = await authenticateExtensionRequest(request);
  const now = new Date();
  await getDatabase().transaction(async (tx) => {
    await tx.update(schema.extensionSessions).set({ revokedAt: now }).where(eq(schema.extensionSessions.id, session.id));
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: session.userId, entidade: "extension_session", entidadeId: session.id, acao: "extension.session.revoked" });
  });
}

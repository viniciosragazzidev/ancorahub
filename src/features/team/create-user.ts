import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireCanCreateRole } from "@/shared/auth/team-permissions";
import { getDatabase, schema } from "@/shared/db";
import { generateNextInternalCode, createBrokerInvitation } from "./onboarding-helpers";
import { enqueueBrokerInvitation } from "./broker-invitation-delivery";

const createUserInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  phone: z.string().trim().min(8).max(30),
  cpf: z.string().trim().max(20).optional().or(z.literal("")),
  // The UI sends the job title and profile separately. Older clients could
  // accidentally send the title (e.g. "marketing") as role; normalize that
  // value server-side so only the two supported access profiles reach the
  // permission guard. A manager request still goes through requireCanCreateRole.
  role: z.preprocess((value) => value === "director" ? "director" : value === "manager" ? "manager" : value === "supervisor" ? "supervisor" : "broker", z.enum(["director", "manager", "supervisor", "broker"])),
  jobTitle: z.enum(["director", "manager", "supervisor", "broker", "marketing", "finance", "operations", "support"]).default("broker"),
  branchId: z.string().uuid(),
});

export async function createTeamUser(rawInput: unknown) {
  const input = createUserInput.parse(rawInput);
  const context = requireCanCreateRole(await getRequiredTenantContext(), input.role);
  if (context.role === "manager" && input.branchId !== context.branchId) {
    throw new Error("Gestores só podem criar acessos na própria unidade.");
  }

  const db = getDatabase();

  const [branch] = await db
    .select()
    .from(schema.branches)
    .where(
      and(
        eq(schema.branches.id, input.branchId),
        eq(schema.branches.tenantId, context.tenantId),
        eq(schema.branches.status, "active"),
      ),
    )
    .limit(1);
  if (!branch) throw new Error("A filial selecionada não pertence ao tenant ativo ou está inativa.");

  const [existingEmail] = await db
    .select({ id: schema.brokerProfiles.id })
    .from(schema.brokerProfiles)
    .where(and(eq(schema.brokerProfiles.invitedEmail, input.email), eq(schema.brokerProfiles.tenantId, context.tenantId)))
    .limit(1);
  if (existingEmail) throw new Error("Já existe um corretor com este e-mail.");

  const normalizedCpf = input.cpf?.replace(/\D/g, "") || null;
  const [existingCpf] = normalizedCpf ? await db
    .select({ id: schema.brokerProfiles.id })
    .from(schema.brokerProfiles)
    .where(and(eq(schema.brokerProfiles.cpf, normalizedCpf), eq(schema.brokerProfiles.tenantId, context.tenantId)))
    .limit(1) : [];
  const normalizedPhone = input.phone.replace(/\D/g, "");
  if (normalizedPhone.length < 10 || normalizedPhone.length > 15) throw new Error("Informe um telefone internacional válido.");
  const [existingPhone] = await db
    .select({ id: schema.brokerProfiles.id })
    .from(schema.brokerProfiles)
    .where(and(eq(schema.brokerProfiles.tenantId, context.tenantId), eq(schema.brokerProfiles.phone, normalizedPhone)))
    .limit(1);
  if (existingPhone) throw new Error("Já existe um acesso com este telefone nesta corretora.");
  if (existingCpf) throw new Error("Já existe um corretor com este CPF.");

  const [existingUser] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, input.email))
    .limit(1);

  if (existingUser) {
    const [membershipInTenant] = await db
      .select({ id: schema.tenantMemberships.id })
      .from(schema.tenantMemberships)
      .where(
        and(
          eq(schema.tenantMemberships.userId, existingUser.id),
          eq(schema.tenantMemberships.tenantId, context.tenantId),
        ),
      )
      .limit(1);

    if (membershipInTenant) {
      throw new Error("Já existe um membro da equipe cadastrado com este e-mail nesta corretora.");
    }
  }

  const brokerProfileId = randomUUID();
  let inviteToken = "";
  let invitationId = "";

  await db.transaction(async (tx) => {
    const internalCode = await generateNextInternalCode(tx, context.tenantId);

    await tx.insert(schema.brokerProfiles).values({
      id: brokerProfileId,
      tenantId: context.tenantId,
      branchId: input.branchId,
      userId: null,
      internalCode,
      professionalName: input.name,
      phone: normalizedPhone,
      invitedEmail: input.email,
      cpf: normalizedCpf,
      lifecycleStatus: "INVITED",
      managerId: context.userId,
      invitedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const invitation = await createBrokerInvitation(tx, context.tenantId, input.branchId, brokerProfileId, input.email, input.role, input.jobTitle);
    const { token } = invitation;
    inviteToken = token;
    invitationId = invitation.id;

    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "broker_profile",
      entidadeId: brokerProfileId,
      acao: "criou_corretor_onboarding",
    });
  });

  const whatsappStatus = await enqueueBrokerInvitation({
    tenantId: context.tenantId,
    branchId: input.branchId,
    invitationId,
    destinationPhone: normalizedPhone,
    name: input.name,
    jobTitle: input.jobTitle,
    role: input.role,
    requestedBy: context.userId,
  });

  return { token: inviteToken, invitationId, whatsappStatus };
}

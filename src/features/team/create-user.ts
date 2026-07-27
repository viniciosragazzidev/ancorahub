import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireCanCreateRole } from "@/shared/auth/team-permissions";
import { getDatabase, schema } from "@/shared/db";
import { generateNextInternalCode, createBrokerInvitation } from "./onboarding-helpers";
import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { META_CLOUD_PROVIDER } from "@/features/communication-channels/types";

const createUserInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  phone: z.string().trim().min(8).max(30),
  cpf: z.string().trim().max(20).optional().or(z.literal("")),
  // The UI sends the job title and profile separately. Older clients could
  // accidentally send the title (e.g. "marketing") as role; normalize that
  // value server-side so only the two supported access profiles reach the
  // permission guard. A manager request still goes through requireCanCreateRole.
  role: z.preprocess((value) => value === "manager" ? "manager" : "broker", z.enum(["manager", "broker"])),
  jobTitle: z.enum(["director", "manager", "broker", "marketing", "finance", "operations", "support"]).default("broker"),
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
  if (existingUser) throw new Error("Já existe uma identidade com este e-mail.");

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

  let whatsappStatus: "queued" | "not_available" | "failed" | "sent" = "not_available";
  try {
    const [channel] = await db.select({ id: schema.communicationChannels.id }).from(schema.communicationChannels).where(and(
      eq(schema.communicationChannels.tenantId, context.tenantId),
      eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER),
      eq(schema.communicationChannels.status, "active"),
      eq(schema.communicationChannels.isDefault, true),
    )).limit(1);
    if (channel) {
      const company = await db.select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1);
      const roleLabel = input.jobTitle === "manager" ? "Gestor" : input.jobTitle === "broker" ? "Corretor" : input.jobTitle;
      const queued = await enqueueMetaTemplateMessage({
        tenantId: context.tenantId,
        recipientType: "user",
        recipientId: invitationId,
        destinationPhone: input.phone,
        purpose: "brokerInvitation",
        variables: [input.name, company[0]?.name ?? "sua corretora", roleLabel],
        requestedBy: context.userId,
        idempotencyKey: `team-invitation:${invitationId}`,
      });
      whatsappStatus = queued.duplicate || queued.status === "queued" ? "queued" : "failed";
      await db.update(schema.brokerInvitations).set({ deliveryStatus: whatsappStatus === "queued" ? "queued" : "failed" }).where(eq(schema.brokerInvitations.id, invitationId));
      // Process the newly queued message immediately. The scheduled job remains
      // the recovery path, but Vercel Hobby can run it only once per day.
      try {
        const firstAttempt = await processMetaOutboundBatch(10, context.tenantId);
        if (firstAttempt.failed > 0) await processMetaOutboundBatch(10, context.tenantId);
      } catch {
        // Keep the invitation queued; the protected worker will retry it later.
      }
      const [delivery] = await db.select({ status: schema.brokerInvitations.deliveryStatus }).from(schema.brokerInvitations).where(and(eq(schema.brokerInvitations.id, invitationId), eq(schema.brokerInvitations.tenantId, context.tenantId))).limit(1);
      if (delivery?.status === "sent") whatsappStatus = "sent";
      else if (delivery?.status === "failed") whatsappStatus = "failed";
    } else {
      await db.update(schema.brokerInvitations).set({ deliveryStatus: "not_available" }).where(eq(schema.brokerInvitations.id, invitationId));
    }
  } catch {
    await db.update(schema.brokerInvitations).set({ deliveryStatus: "failed", deliveryError: "Não foi possível enfileirar o convite." }).where(eq(schema.brokerInvitations.id, invitationId));
    whatsappStatus = "failed";
  }

  return { token: inviteToken, invitationId, whatsappStatus };
}

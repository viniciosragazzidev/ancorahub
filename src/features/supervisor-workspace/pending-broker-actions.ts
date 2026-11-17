"use server";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { assertBrokerRegistrationAvailable, brokerRegistrationInput } from "@/features/team/broker-registration";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

type ActionResult = { ok: true; message: string } | { ok: false; message: string };

const pendingEditInput = brokerRegistrationInput.extend({
  brokerProfileId: z.string().uuid(),
});

async function getSupervisorContext() {
  const context = await getRequiredTenantContext();
  if (context.role !== "supervisor" || !context.supervisorTeamScope || !context.branchId || (await getLiteAudience(context)) !== "supervisor") return null;
  return context;
}

/**
 * Supervisor edits the registration of a broker he added, while the broker has
 * not accepted yet. Only the supervisor's own pending invitation in his unit
 * is editable; the broker joins the team when he accepts and finishes the access.
 */
export async function updatePendingSupervisedBrokerAction(rawInput: unknown): Promise<ActionResult> {
  const parsed = pendingEditInput.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira os dados do corretor." };
  const context = await getSupervisorContext();
  if (!context) return { ok: false, message: "Apenas o supervisor da unidade pode editar corretores da própria equipe." };
  const data = parsed.data;
  try {
    const result = await getDatabase().transaction(async (tx) => {
      const [pending] = await tx.select({
        invitationId: schema.brokerInvitations.id,
        brokerProfileId: schema.brokerProfiles.id,
        internalCode: schema.brokerProfiles.internalCode,
      }).from(schema.brokerInvitations)
        .innerJoin(schema.brokerProfiles, and(
          eq(schema.brokerProfiles.id, schema.brokerInvitations.brokerProfileId),
          eq(schema.brokerProfiles.tenantId, context.tenantId),
        ))
        .where(and(
          eq(schema.brokerInvitations.tenantId, context.tenantId),
          eq(schema.brokerInvitations.brokerProfileId, data.brokerProfileId),
          eq(schema.brokerInvitations.supervisorId, context.userId),
          eq(schema.brokerInvitations.branchId, context.branchId!),
          eq(schema.brokerInvitations.role, "broker"),
          eq(schema.brokerInvitations.status, "PENDING"),
          eq(schema.brokerProfiles.branchId, context.branchId!),
        ))
        .limit(1)
        .for("update");
      if (!pending) return { ok: false as const, message: "Este corretor não está mais pendente na sua equipe. Atualize a tela." };

      const brokerCode = data.brokerCode ?? pending.internalCode;
      const registration = { email: data.email, phone: data.phone, cpf: data.cpf, brokerCode };
      await assertBrokerRegistrationAvailable(tx, { tenantId: context.tenantId, profileId: pending.brokerProfileId, registration });

      const now = new Date();
      await tx.update(schema.brokerProfiles).set({
        professionalName: data.name,
        invitedEmail: data.email,
        phone: data.phone,
        cpf: data.cpf,
        internalCode: brokerCode,
        updatedAt: now,
      }).where(and(eq(schema.brokerProfiles.id, pending.brokerProfileId), eq(schema.brokerProfiles.tenantId, context.tenantId)));
      await tx.update(schema.brokerInvitations).set({ email: data.email })
        .where(and(eq(schema.brokerInvitations.id, pending.invitationId), eq(schema.brokerInvitations.status, "PENDING")));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "broker_profile",
        entidadeId: pending.brokerProfileId,
        acao: "supervisor_team.pending_broker_updated",
        createdAt: now,
      });
      return { ok: true as const };
    });
    if (!result.ok) return result;
  } catch (error) {
    return { ok: false, message: error instanceof Error && error.message.startsWith("Já existe") ? error.message : "Não consegui salvar agora. Tente de novo em instantes." };
  }
  revalidatePath("/equipe/minha");
  return { ok: true, message: "Cadastro atualizado." };
}

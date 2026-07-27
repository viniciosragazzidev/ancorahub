import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { assertTenantAccess } from "@/shared/auth/authorization";
import { hasPermission } from "@/shared/auth/permissions";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import { publishNotification } from "@/features/notifications/send-push-helper";
import type { TenantContext } from "@/shared/auth/types";
import {
  LEAD_STATUS_LABELS,
  MOTIVOS_PERDA,
  MOTIVO_PERDA_LABELS,
  VALID_TRANSITIONS,
} from "./lead-status-constants";
import type { MotivoPerda } from "./lead-status-constants";

// ─── Tipos ────────────────────────────────────────────────────────────

export type LeadStatus = (typeof schema.leadStatusValues)[number];

export type ChangeLeadStatusInput = {
  leadId: string;
  newStatus: string;
  motivoPerda?: string | null;
};

export type ChangeLeadStatusResult = {
  success: true;
  previousStatus: string;
  newStatus: string;
  reopened: boolean;
};

// ─── Validação do input ───────────────────────────────────────────────

const changeStatusInput = z.object({
  leadId: z.string().min(1, "ID do lead é obrigatório."),
  newStatus: z.enum(
    schema.leadStatusValues as unknown as [string, ...string[]],
    { message: "Status inválido." },
  ),
  motivoPerda: z.string().optional().nullable(),
});

// ─── Serviço principal ────────────────────────────────────────────────

async function assertCanChangeStatus(
  context: TenantContext,
  lead: { tenantId: string; corretorId: string | null; branchId: string | null; status?: string },
) {
  assertTenantAccess(context, lead.tenantId);

  if (!hasPermission(context.role, "alterar_status_lead")) {
    throw new AuthorizationError("Seu papel não pode alterar status de leads.");
  }

  // Se o lead tem um corretor responsável, apenas esse corretor pode alterar o status
  if (lead.corretorId) {
    if (context.userId !== lead.corretorId) {
      throw new AuthorizationError("Apenas o corretor responsável por este lead pode alterar o seu status.");
    }
  } else {
    // Se não tem corretor, apenas gestores/diretores podem alterar (corretores não)
    if (context.role === "broker") {
      throw new AuthorizationError("Este lead não está atribuído a você.");
    }
  }

  if (context.role === "broker" && lead.status === "distributed") {
    throw new AuthorizationError("Inicie o atendimento antes de alterar o status deste lead.");
  }

  // Gestor: só pode alterar leads da sua filial (caso não haja corretor atribuído)
  if (context.role === "manager" && !lead.corretorId) {
    if (!lead.branchId || !context.branchId || context.branchId !== lead.branchId) {
      throw new AuthorizationError("Você só pode alterar status de leads da sua filial.");
    }
  }
}

async function assertCanReopen(context: TenantContext) {
  if (!hasPermission(context.role, "reabrir_lead_perdido")) {
    throw new AuthorizationError(
      "Apenas gestores e diretores podem reabrir leads perdidos.",
    );
  }
}

export async function changeLeadStatus(
  rawInput: ChangeLeadStatusInput,
): Promise<ChangeLeadStatusResult> {
  const input = changeStatusInput.parse(rawInput);
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  // Buscar o lead
  const [lead] = await db
    .select({
      id: schema.leads.id,
      tenantId: schema.leads.tenantId,
      corretorId: schema.leads.corretorId,
      branchId: schema.leads.branchId,
      status: schema.leads.status,
      nome: schema.leads.nome,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, context.tenantId)))
    .limit(1);

  if (!lead) {
    throw new Error("Lead não encontrado.");
  }

  const previousStatus = lead.status;
  const newStatus = input.newStatus;

  // ─── Validações de transição ─────────────────────────────────────────

  // 1. convertido: não pode ser selecionado manualmente
  if (newStatus === "converted") {
    throw new Error(
      "O status 'Convertido' não pode ser definido manualmente. Ele é atribuído automaticamente ao registrar uma venda.",
    );
  }

  // 2. validação de transição do pipeline
  const allowedNext = VALID_TRANSITIONS[previousStatus];
  if (allowedNext && !allowedNext.includes(newStatus)) {
    throw new Error(
      `Transição inválida: ${LEAD_STATUS_LABELS[previousStatus] ?? previousStatus} → ${LEAD_STATUS_LABELS[newStatus] ?? newStatus}.`,
    );
  }

  // 3. perdido: exige motivo
  if (newStatus === "lost") {
    if (!input.motivoPerda || !(MOTIVOS_PERDA as readonly string[]).includes(input.motivoPerda)) {
      throw new Error(
        "É obrigatório informar um motivo de perda válido para marcar o lead como perdido.",
      );
    }
    await assertCanChangeStatus(context, lead);
  }

  // 3. Reabertura (saindo de lost)
  const isReopening = previousStatus === "lost" && newStatus !== "lost";

  if (isReopening) {
    await assertCanReopen(context);
  } else {
    await assertCanChangeStatus(context, lead);
  }

  // ─── Executar mudança ───────────────────────────────────────────────
  const now = new Date();
  const motivoPerda = newStatus === "lost" ? input.motivoPerda! : null;

  await db.transaction(async (tx) => {
    // Atualizar lead
    await tx
      .update(schema.leads)
      .set({
        status: newStatus as LeadStatus,
        stageEnteredAt: now,
        motivoPerda,
      })
      .where(eq(schema.leads.id, lead.id));

    // Criar interação na timeline
    const interactionContent = isReopening
      ? `Lead reaberto (${previousStatus} → ${LEAD_STATUS_LABELS[newStatus] ?? newStatus}) por ${context.role === "director" ? "Diretor" : "Gestor"}.`
      : newStatus === "lost"
        ? `Status alterado: ${LEAD_STATUS_LABELS[previousStatus] ?? previousStatus} → Perdido. Motivo: ${MOTIVO_PERDA_LABELS[input.motivoPerda as MotivoPerda] ?? input.motivoPerda}`
        : `Status alterado: ${LEAD_STATUS_LABELS[previousStatus] ?? previousStatus} → ${LEAD_STATUS_LABELS[newStatus] ?? newStatus}.`;

    await tx.insert(schema.leadInteractions).values({
      id: randomUUID(),
      leadId: lead.id,
      userId: context.userId,
      tipo: "status_change",
      conteudo: interactionContent,
    });

    // Criar auditoria
    const auditAction = isReopening
      ? "reabriu"
      : newStatus === "lost"
        ? "perdeu"
        : "alterou";

    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "lead",
      entidadeId: lead.id,
      acao: auditAction,
    });
  });

  // ─── Notificações fora da transação (push pode falhar sem efeito colateral) ───

  if (newStatus === "lost") {
    const scope = lead.branchId
      ? or(eq(schema.tenantMemberships.role, "director"), and(eq(schema.tenantMemberships.role, "manager"), eq(schema.tenantMemberships.branchId, lead.branchId)))
      : eq(schema.tenantMemberships.role, "director");
    const supervisors = await db
      .select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, lead.tenantId), eq(schema.tenantMemberships.status, "active"), scope))
      .groupBy(schema.tenantMemberships.userId)
      .limit(5);

    await Promise.allSettled([
      // Notify the broker
      ...(lead.corretorId
        ? [publishNotification({
            capability: "lead_lost",
            tenantId: lead.tenantId,
            recipientUserId: lead.corretorId,
            leadId: lead.id,
            type: "lead_lost",
            title: "Lead perdido",
            message: `${lead.nome} foi marcado como perdido. Motivo: ${MOTIVO_PERDA_LABELS[input.motivoPerda as MotivoPerda] ?? input.motivoPerda}`,
            pushTitle: "Lead Perdido 💔",
            pushBody: `${lead.nome} — ${MOTIVO_PERDA_LABELS[input.motivoPerda as MotivoPerda] ?? input.motivoPerda}.`,
            url: `/leads/${lead.id}`,
            tag: `lead-${lead.id}`,
          })]
        : []),
      // Notify managers and directors
      ...supervisors.map((supervisor) =>
        publishNotification({
          capability: "lead_lost",
          tenantId: lead.tenantId,
          recipientUserId: supervisor.userId,
          leadId: lead.id,
          type: "lead_lost",
          title: "Lead perdido",
          message: `${lead.nome} foi perdido. Motivo: ${MOTIVO_PERDA_LABELS[input.motivoPerda as MotivoPerda] ?? input.motivoPerda}`,
          pushTitle: "Lead Perdido! 📉",
          pushBody: `${lead.nome} foi perdido — ${MOTIVO_PERDA_LABELS[input.motivoPerda as MotivoPerda] ?? input.motivoPerda}.`,
          url: `/leads/${lead.id}`,
          tag: `lead-${lead.id}`,
        }),
      ),
    ].map((p) => p.catch(() => { /* non-blocking */ })));
  }

  if (isReopening) {
    const roleLabel = context.role === "director" ? "Diretor" : "Gestor";
    const newStatusLabel = LEAD_STATUS_LABELS[newStatus] ?? newStatus;

    // Notify the broker (if they exist and it's not the re-opening user)
    if (lead.corretorId && lead.corretorId !== context.userId) {
      void publishNotification({
        capability: "lead_reopened",
        tenantId: lead.tenantId,
        recipientUserId: lead.corretorId,
        leadId: lead.id,
        type: "lead_reopened",
        title: "Lead reaberto",
        message: `${lead.nome} foi reaberto por ${roleLabel} e está agora em "${newStatusLabel}".`,
        pushTitle: "Lead Reaberto! 🔄",
        pushBody: `${lead.nome} foi reaberto por ${roleLabel} — status: ${newStatusLabel}.`,
        url: `/leads/${lead.id}`,
        tag: `lead-${lead.id}`,
      }).catch(() => { /* non-blocking */ });
    }

    // Notify managers and directors
    const scope = lead.branchId
      ? or(eq(schema.tenantMemberships.role, "director"), and(eq(schema.tenantMemberships.role, "manager"), eq(schema.tenantMemberships.branchId, lead.branchId)))
      : eq(schema.tenantMemberships.role, "director");
    const supervisors = await db
      .select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, lead.tenantId), eq(schema.tenantMemberships.status, "active"), scope))
      .groupBy(schema.tenantMemberships.userId)
      .limit(5);

    await Promise.allSettled(
      supervisors
        .filter((s) => s.userId !== context.userId)
        .map((supervisor) =>
          publishNotification({
            capability: "lead_reopened",
            tenantId: lead.tenantId,
            recipientUserId: supervisor.userId,
            leadId: lead.id,
            type: "lead_reopened",
            title: "Lead reaberto",
            message: `${lead.nome} foi reaberto por ${roleLabel} e está em "${newStatusLabel}".`,
            pushTitle: "Lead Reaberto! 🔄",
            pushBody: `${lead.nome} foi reaberto — novo status: ${newStatusLabel}.`,
            url: `/leads/${lead.id}`,
            tag: `lead-${lead.id}`,
          }).catch(() => { /* non-blocking */ }),
        ),
    );
  }

  return {
    success: true,
    previousStatus,
    newStatus,
    reopened: isReopening,
  };
}

"use server";

/**
 * Ações da visão "Esfriando" (26/11/2026): Assumir, Cobrar corretor e Redistribuir um lead parado.
 * Quem pode e em que escopo está em `cooling-lead-actions-rules.ts` (diretor: empresa; gestor: unidade;
 * supervisor: equipe; corretor: nada). A cobrança usa o serviço de tarefas do lead (`criarTarefaDoLead`) e a
 * redistribuição usa o repasse que já existe (`reassignLeadAction`), com o corretor escolhido na unidade.
 *
 * O retorno segue o `LiteActionOutcome`: `{ ok: true }` só depois de gravado; `{ ok: false, message }` com a causa.
 */
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, like } from "drizzle-orm";
import { z } from "zod";

import { AuthorizationError } from "@/shared/auth/errors";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { getActiveQueueDutyRoster } from "@/features/lead-distribution/active-queue-duty-roster";
import { getUnitBrokerIds } from "@/features/manager-scope/unit-brokers";
import { notifyLeadReassigned } from "@/features/notifications/send-push-helper";
import { getSystemSetting } from "@/features/system-settings/queries";

import { leadLastContactAtSql } from "./cooling-radar-query";
import { isCoolingWatched, lastActivityMs } from "./cooling-radar";
import {
  buildNudgeTask,
  canRunCoolingActions,
  COOLING_REDISTRIBUTE_REASON,
  coolingScopeAllows,
  NUDGE_TASK_PREFIX,
} from "./cooling-lead-actions-rules";
import { reassignLeadAction } from "./management-actions";
import { publishLeadInvalidation } from "./publish-lead-invalidation";
import { criarTarefaDoLead } from "./tarefa-servico";

export type CoolingActionResult =
  | { ok: true; message: string; corretorId?: string | null; corretorNome?: string | null }
  | { ok: false; message: string; retryable?: boolean };

export type CoolingBrokerOption = { id: string; name: string; scheduleId?: string };

const leadIdSchema = z.string().min(1).max(64);
const ACTOR_LABEL: Record<string, string> = { director: "Diretor", manager: "Gestor", supervisor: "Supervisor" };
const OPEN_OFFER_STATUSES = ["PENDING", "SENT", "DELIVERED", "READ"] as const;

/** Corretores ativos da equipe do supervisor. */
async function getSupervisorTeamBrokerIds(tenantId: string, supervisorId: string) {
  const rows = await getDatabase().select({ userId: schema.tenantMemberships.userId }).from(schema.tenantMemberships).where(and(
    eq(schema.tenantMemberships.tenantId, tenantId),
    eq(schema.tenantMemberships.supervisorId, supervisorId),
    eq(schema.tenantMemberships.status, "active"),
    eq(schema.tenantMemberships.role, "broker"),
  ));
  return rows.map((row) => row.userId);
}

/** O lead do tenant, aberto, no escopo de quem age. Lança erro com a mensagem para a tela. */
async function loadCoolingLead(context: TenantContext, leadId: string) {
  if (!canRunCoolingActions(context.role)) throw new AuthorizationError("Só diretor, gestor e supervisor agem nos leads parados.");
  const [lead] = await getDatabase()
    .select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      status: schema.leads.status,
      corretorId: schema.leads.corretorId,
      corretorNome: schema.user.name,
      branchId: schema.leads.branchId,
      queueId: schema.leads.queueId,
      webhookCredentialId: schema.leads.webhookCredentialId,
      createdAt: schema.leads.createdAt,
      assignedAt: schema.leads.assignedAt,
      stageEnteredAt: schema.leads.stageEnteredAt,
      lastContactAt: leadLastContactAtSql,
    })
    .from(schema.leads)
    .leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id))
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt)))
    .limit(1);
  if (!lead) throw new Error("Lead não encontrado.");
  const team = context.role === "supervisor" ? await getSupervisorTeamBrokerIds(context.tenantId, context.userId) : [];
  if (!coolingScopeAllows({ role: context.role, userId: context.userId, branchId: context.branchId }, lead, team)) {
    throw new AuthorizationError("Este lead está fora do seu escopo.");
  }
  return { lead, team };
}

function failure(error: unknown, fallback: string): CoolingActionResult {
  if (error instanceof Error && error.message) return { ok: false, message: error.message };
  return { ok: false, message: fallback };
}

async function assertManagementEnabled() {
  if ((await getSystemSetting("feature_lead_management_actions_enabled")) === "false") {
    throw new Error("As ações de gestão de leads estão desativadas pelo Super-admin.");
  }
}

/** "Assumir": o lead passa para quem age (diretor, gestor ou supervisor), com histórico e aviso ao corretor anterior. */
export async function assumeCoolingLeadAction(leadId: string): Promise<CoolingActionResult> {
  try {
    const id = leadIdSchema.parse(leadId);
    const context = await getRequiredTenantContext();
    const { lead } = await loadCoolingLead(context, id);
    if (lead.corretorId === context.userId) return { ok: true, message: "O lead já é seu.", corretorId: context.userId };
    if (!isCoolingWatched(lead.status)) throw new Error("Este lead saiu do radar. Atualize a página.");
    await assertManagementEnabled();
    const previousOwnerId = lead.corretorId;
    const actor = ACTOR_LABEL[context.role] ?? "Gestor";
    const now = new Date();
    const db = getDatabase();
    const changed = await db.transaction(async (tx) => {
      const updated = await tx.update(schema.leads).set({
        corretorId: context.userId,
        distributionStatus: "assigned",
        assignmentSource: context.role === "director" ? "manual_director" : "manual_manager",
        assignmentStrategy: "manual",
        assignedAt: now,
        distributionUpdatedAt: now,
        updatedAt: now,
      }).where(and(
        eq(schema.leads.id, lead.id),
        eq(schema.leads.tenantId, context.tenantId),
        previousOwnerId ? eq(schema.leads.corretorId, previousOwnerId) : isNull(schema.leads.corretorId),
        eq(schema.leads.status, lead.status),
      )).returning({ id: schema.leads.id });
      if (!updated.length) return false;
      // Oferta pendente e tentativa aberta do corretor anterior deixam de valer: o lead agora tem dono.
      await tx.update(schema.leadOffers).set({ status: "CANCELLED", updatedAt: now }).where(and(
        eq(schema.leadOffers.tenantId, context.tenantId),
        eq(schema.leadOffers.leadId, lead.id),
        inArray(schema.leadOffers.status, [...OPEN_OFFER_STATUSES]),
      ));
      await tx.update(schema.leadAssignmentAttempts).set({ status: "released", releasedAt: now, releaseReason: `Lead assumido por ${actor} no radar Esfriando.` }).where(and(
        eq(schema.leadAssignmentAttempts.tenantId, context.tenantId),
        eq(schema.leadAssignmentAttempts.leadId, lead.id),
        eq(schema.leadAssignmentAttempts.status, "open"),
      ));
      await tx.insert(schema.leadDistributionEvents).values({
        id: randomUUID(),
        tenantId: context.tenantId,
        leadId: lead.id,
        fromBranchId: lead.branchId,
        toBranchId: lead.branchId,
        fromQueueId: lead.queueId,
        toQueueId: lead.queueId,
        previousOwnerId,
        newOwnerId: context.userId,
        action: "assigned",
        source: context.role === "director" ? "manual_director" : "manual_manager",
        strategy: "manual",
        reason: `Lead parado assumido por ${actor} no radar Esfriando.`,
        actorId: context.userId,
        createdAt: now,
      });
      await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId: lead.id, userId: context.userId, tipo: "system_alert", conteudo: `${actor} assumiu o lead parado no radar Esfriando.` });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: lead.id, acao: "assumiu_lead_esfriando", createdAt: now });
      return true;
    });
    if (!changed) throw new Error("O lead mudou agora há pouco. Atualize a página.");
    if (previousOwnerId) void notifyLeadReassigned(lead.id, context.tenantId, previousOwnerId, lead.nome).catch(() => undefined);
    void publishLeadInvalidation({ tenantId: context.tenantId, actorId: context.userId, branchIds: [lead.branchId], brokerIds: [previousOwnerId, context.userId] }).catch(() => undefined);
    return { ok: true, message: "O lead agora é seu.", corretorId: context.userId };
  } catch (error) {
    return failure(error, "Não consegui assumir o lead agora.");
  }
}

/** "Cobrar corretor": tarefa para o corretor responsável com o nome do lead e há quanto tempo está parado. */
export async function nudgeCoolingBrokerAction(leadId: string): Promise<CoolingActionResult> {
  try {
    const id = leadIdSchema.parse(leadId);
    const context = await getRequiredTenantContext();
    const { lead } = await loadCoolingLead(context, id);
    if (!lead.corretorId) throw new Error("Este lead está sem corretor. Use Redistribuir.");
    if (lead.corretorId === context.userId) throw new Error("O lead já é seu.");
    const [open] = await getDatabase().select({ id: schema.leadTasks.id }).from(schema.leadTasks).where(and(
      eq(schema.leadTasks.tenantId, context.tenantId),
      eq(schema.leadTasks.leadId, lead.id),
      isNull(schema.leadTasks.completedAt),
      like(schema.leadTasks.title, `${NUDGE_TASK_PREFIX}%`),
    )).limit(1);
    if (open) return { ok: false, message: "O corretor já foi cobrado. A tarefa continua aberta.", retryable: false };
    const now = new Date();
    const anchor = lastActivityMs(lead);
    const task = buildNudgeTask({ leadName: lead.nome, idleMs: anchor === null ? 0 : Math.max(0, now.getTime() - anchor), actorRole: context.role, now });
    await criarTarefaDoLead(context, { leadId: lead.id, ...task, assigneeIds: [lead.corretorId] });
    void publishLeadInvalidation({ tenantId: context.tenantId, actorId: context.userId, branchIds: [lead.branchId], brokerIds: [lead.corretorId] }).catch(() => undefined);
    return { ok: true, message: `Tarefa criada para ${lead.corretorNome ?? "o corretor"}.` };
  } catch (error) {
    return failure(error, "Não consegui cobrar o corretor agora.");
  }
}

/**
 * Corretores para "Redistribuir": com plantão ativo na fila, os escalados nele; sem plantão, os corretores ativos
 * da unidade do lead. Gestor vê só os da unidade dele e supervisor só os da equipe. O dono atual sai da lista.
 */
export async function listCoolingRedistributeOptionsAction(leadId: string): Promise<{ ok: true; brokers: CoolingBrokerOption[]; onDuty: boolean } | { ok: false; message: string }> {
  try {
    const id = leadIdSchema.parse(leadId);
    const context = await getRequiredTenantContext();
    const { lead, team } = await loadCoolingLead(context, id);
    const roster = await getActiveQueueDutyRoster({ tenantId: context.tenantId, queueId: lead.queueId, webhookCredentialId: lead.webhookCredentialId });
    let brokers: CoolingBrokerOption[];
    if (roster.hasActiveDuty) {
      brokers = roster.brokers.map((broker) => ({ id: broker.id, name: broker.name, scheduleId: broker.scheduleId }));
      if (context.role === "manager") {
        const unit = new Set(await getUnitBrokerIds(context.tenantId, context.branchId ?? null));
        brokers = brokers.filter((broker) => unit.has(broker.id));
      }
    } else {
      if (!lead.branchId) throw new Error("O lead está sem unidade. Envie para uma unidade antes de redistribuir.");
      brokers = await getDatabase().select({ id: schema.user.id, name: schema.user.name }).from(schema.tenantMemberships)
        .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
        .where(and(
          eq(schema.tenantMemberships.tenantId, context.tenantId),
          eq(schema.tenantMemberships.branchId, lead.branchId),
          eq(schema.tenantMemberships.role, "broker"),
          eq(schema.tenantMemberships.status, "active"),
          eq(schema.user.active, true),
          eq(schema.user.status, "active"),
        ))
        .orderBy(asc(schema.user.name));
    }
    if (context.role === "supervisor") brokers = brokers.filter((broker) => team.includes(broker.id));
    return { ok: true, onDuty: roster.hasActiveDuty, brokers: brokers.filter((broker) => broker.id !== lead.corretorId) };
  } catch (error) {
    const result = failure(error, "Não consegui carregar os corretores agora.");
    return { ok: false, message: result.message };
  }
}

/** "Redistribuir": repasse direto ao corretor escolhido, pelo mesmo caminho do "Trocar corretor" (`reassignLeadAction`). */
export async function redistributeCoolingLeadAction(input: { leadId: string; brokerId: string; dutyScheduleId?: string | null }): Promise<CoolingActionResult> {
  try {
    const id = leadIdSchema.parse(input?.leadId);
    const brokerId = z.string().min(1).parse(input?.brokerId);
    const context = await getRequiredTenantContext();
    const { lead, team } = await loadCoolingLead(context, id);
    if (brokerId === lead.corretorId) throw new Error("Escolha outro corretor.");
    if (context.role === "supervisor" && !team.includes(brokerId)) throw new AuthorizationError("Escolha um corretor da sua equipe.");
    const formData = new FormData();
    formData.set("leadId", lead.id);
    formData.set("brokerId", brokerId);
    if (input.dutyScheduleId) formData.set("dutyScheduleId", input.dutyScheduleId);
    formData.set("reason", COOLING_REDISTRIBUTE_REASON);
    if (!lead.corretorId) formData.set("assignmentMode", "direct");
    const result = await reassignLeadAction({}, formData);
    if (!result.success) return { ok: false, message: result.error ?? "Não consegui redistribuir o lead agora." };
    const [broker] = await getDatabase().select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, brokerId)).limit(1);
    return { ok: true, message: `Lead passou para ${broker?.name ?? "o corretor escolhido"}.`, corretorId: brokerId, corretorNome: broker?.name ?? null };
  } catch (error) {
    return failure(error, "Não consegui redistribuir o lead agora.");
  }
}

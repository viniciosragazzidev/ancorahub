import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { publishNotification } from "@/features/notifications/send-push-helper";
import { FEATURE_FLAGS, getFeatureFlag, getSystemSetting, setSystemSetting } from "@/features/system-settings/queries";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";

import { isAiPotentialSale } from "./ai-potential-sale";
import { changeLeadStatus } from "./change-lead-status";
import { LEAD_STATUS_LABELS } from "./lead-status-constants";
import {
  decideStaleStage,
  parseStaleStageMode,
  STALE_RULE,
  STALE_WATCH_STATUSES,
  staleStageModeKey,
  staleStageSimulationKey,
  type StaleStageDecision,
  type StaleStageMode,
} from "./stale-stage-rule";

type Candidate = {
  id: string;
  tenantId: string;
  nome: string;
  status: string;
  corretorId: string | null;
  branchId: string | null;
  stageEnteredAt: Date;
  stageHoldUntil: Date | null;
  stageBeforeAwaiting: string | null;
  qualificationDetails: unknown;
  lastCustomerAt: Date | null;
  lastHumanChangeAt: Date | null;
  brokerName: string | null;
};

export type StaleSimulationItem = { leadId: string; name: string; brokerName: string | null; status: string; action: "to_awaiting" | "to_lost"; businessDays: number };
export type StaleSimulation = { at: string; toAwaiting: number; toLost: number; items: StaleSimulationItem[] };

const HUMAN_ACTORS = ["broker", "supervisor", "manager", "director"];

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as T[];
}

const toDate = (value: unknown) => (value ? new Date(value as string) : null);

/** Leads de uma empresa nas etapas olhadas pela regra, com a última mensagem do cliente e a última mudança humana. */
async function loadCandidates(tenantId: string): Promise<Candidate[]> {
  const statuses = sql.join([...STALE_WATCH_STATUSES, "awaiting_reply"].map((status) => sql`${status}`), sql`, `);
  const result = await getDatabase().execute(sql`
    select l.id, l.tenant_id, l.nome, l.status, l.corretor_id, l.branch_id, l.stage_entered_at, l.stage_hold_until,
      l.stage_before_awaiting, l.qualification_details, u.name as broker_name,
      (select max(m.sent_at) from whatsapp_messages m where m.tenant_id = l.tenant_id and m.lead_id = l.id and m.direction = 'incoming') as last_customer_at,
      (select max(h.changed_at) from lead_stage_history h where h.lead_id = l.id and h.actor_type in (${sql.join(HUMAN_ACTORS.map((actor) => sql`${actor}`), sql`, `)})) as last_human_change_at
    from leads l
    left join "user" u on u.id = l.corretor_id
    where l.tenant_id = ${tenantId}
      and l.status in (${statuses})
      and l.corretor_id is not null
      and l.archived_at is null
      and l.deleted_at is null
  `);
  return rowsOf<Record<string, unknown>>(result).map((row) => ({
    id: String(row.id),
    tenantId: String(row.tenant_id),
    nome: String(row.nome ?? "Cliente"),
    status: String(row.status),
    corretorId: (row.corretor_id as string | null) ?? null,
    branchId: (row.branch_id as string | null) ?? null,
    stageEnteredAt: new Date(row.stage_entered_at as string),
    stageHoldUntil: toDate(row.stage_hold_until),
    stageBeforeAwaiting: (row.stage_before_awaiting as string | null) ?? null,
    qualificationDetails: row.qualification_details,
    lastCustomerAt: toDate(row.last_customer_at),
    lastHumanChangeAt: toDate(row.last_human_change_at),
    brokerName: (row.broker_name as string | null) ?? null,
  }));
}

function decide(lead: Candidate, now: Date): StaleStageDecision {
  return decideStaleStage({
    status: lead.status,
    lastCustomerMessageAt: lead.lastCustomerAt,
    stageEnteredAt: lead.stageEnteredAt,
    lastHumanStageChangeAt: lead.lastHumanChangeAt,
    holdUntil: lead.stageHoldUntil,
    potentialSale: isAiPotentialSale(lead.qualificationDetails).isPotentialSale,
    now,
  });
}

async function systemContextFor(tenantId: string): Promise<TenantContext> {
  const userId = await resolveSystemUserId(tenantId);
  return { userId, tenantId, role: "director", jobTitle: "system", branchId: null } as TenantContext;
}

/** Devolve o lead para a etapa em que estava (o cliente respondeu). */
export async function restoreAwaitingLead(lead: { id: string; tenantId: string; stageBeforeAwaiting: string | null }, now = new Date()) {
  const target = lead.stageBeforeAwaiting ?? "in_contact";
  const context = await systemContextFor(lead.tenantId);
  await changeLeadStatus({ leadId: lead.id, newStatus: target }, context, {
    actorUserId: context.userId,
    actorType: "rule",
    expectedStatus: "awaiting_reply",
    skipTransitionCheck: true,
    auditAction: `stale_rule:restore->${target}`,
    reason: "O cliente voltou a responder",
    interactionContent: `O cliente voltou a responder: o lead voltou de Aguardando retorno para ${LEAD_STATUS_LABELS[target] ?? target}.`,
    interactionMetadata: { source: "STALE_RULE", action: "restore", at: now.toISOString() },
  });
}

/**
 * Chamado logo depois de cada mensagem (gatilho da análise de conversa): se o lead está em "Aguardando retorno" e o
 * cliente escreveu depois disso, volta para a etapa anterior. Barato: só lê o lead quando o status bate.
 */
export async function restoreAwaitingLeadIfCustomerReplied(leadId: string, tenantId: string) {
  const db = getDatabase();
  const [lead] = await db.select({ status: schema.leads.status, stageEnteredAt: schema.leads.stageEnteredAt, stageBeforeAwaiting: schema.leads.stageBeforeAwaiting })
    .from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId))).limit(1);
  if (!lead || lead.status !== "awaiting_reply") return false;
  const [message] = await db.select({ id: schema.whatsappMessages.id }).from(schema.whatsappMessages)
    .where(and(
      eq(schema.whatsappMessages.tenantId, tenantId),
      eq(schema.whatsappMessages.leadId, leadId),
      eq(schema.whatsappMessages.direction, "incoming"),
      sql`${schema.whatsappMessages.sentAt} > ${lead.stageEnteredAt}`,
    )).limit(1);
  if (!message) return false;
  await restoreAwaitingLead({ id: leadId, tenantId, stageBeforeAwaiting: lead.stageBeforeAwaiting });
  return true;
}

async function applyDecision(lead: Candidate, decision: StaleStageDecision, now: Date) {
  const context = await systemContextFor(lead.tenantId);
  const notify = (title: string, message: string, key: string) => (lead.corretorId
    ? publishNotification({ capability: "lead_sla", tenantId: lead.tenantId, recipientUserId: lead.corretorId, leadId: lead.id, type: "lead_stale_stage", title, message, url: `/leads/${lead.id}`, idempotencyKey: key })
    : Promise.resolve(false));
  if (decision.action === "restore") {
    await restoreAwaitingLead(lead, now);
    return;
  }
  if (decision.action === "to_awaiting") {
    await changeLeadStatus({ leadId: lead.id, newStatus: "awaiting_reply" }, context, {
      actorUserId: context.userId,
      actorType: "rule",
      expectedStatus: lead.status,
      skipTransitionCheck: true,
      auditAction: `stale_rule:${lead.status}->awaiting_reply`,
      reason: `Cliente sem resposta há ${decision.silentBusinessDays} dias úteis`,
      interactionContent: `Cliente sem resposta há ${decision.silentBusinessDays} dias úteis: o lead saiu de ${LEAD_STATUS_LABELS[lead.status] ?? lead.status} para Aguardando retorno. Ele volta sozinho quando o cliente responder.`,
      interactionMetadata: { source: "STALE_RULE", action: "to_awaiting", silentBusinessDays: decision.silentBusinessDays },
    });
    await notify("Lead aguardando retorno", `${lead.nome} está sem responder há ${decision.silentBusinessDays} dias úteis e foi para Aguardando retorno. Se ainda está em andamento, toque em "Manter na etapa".`, `stale-awaiting:${lead.id}:${lead.stageEnteredAt.toISOString()}`);
    return;
  }
  if (decision.action === "warn_lost") {
    await notify("Lead vai para Perdido", `${lead.nome} segue sem responder. Em ${decision.businessDaysLeft} ${decision.businessDaysLeft === 1 ? "dia útil" : "dias úteis"} ele vai para Perdido (sem contato). Toque em "Manter na etapa" se ainda está em andamento.`, `stale-warn:${lead.id}:${lead.stageEnteredAt.toISOString()}`);
    return;
  }
  if (decision.action === "to_lost") {
    await changeLeadStatus({ leadId: lead.id, newStatus: "lost", motivoPerda: "sem_contato" }, context, {
      actorUserId: context.userId,
      actorType: "rule",
      expectedStatus: "awaiting_reply",
      skipTransitionCheck: true,
      auditAction: "stale_rule:awaiting_reply->lost",
      reason: `Sem resposta há ${decision.awaitingBusinessDays} dias úteis em Aguardando retorno`,
      interactionContent: `Sem resposta do cliente há ${decision.awaitingBusinessDays} dias úteis em Aguardando retorno: o lead foi para Perdido (sem contato).`,
      interactionMetadata: { source: "STALE_RULE", action: "to_lost", awaitingBusinessDays: decision.awaitingBusinessDays },
    });
    return;
  }
  if (decision.action === "potential_sale_hold") {
    // Venda em potencial: não perde sozinho; a gestão da unidade é avisada uma vez.
    const managers = await getDatabase().select({ userId: schema.tenantMemberships.userId }).from(schema.tenantMemberships)
      .where(and(
        eq(schema.tenantMemberships.tenantId, lead.tenantId),
        eq(schema.tenantMemberships.status, "active"),
        lead.branchId
          ? sql`(${schema.tenantMemberships.role} = 'director' or (${schema.tenantMemberships.role} = 'manager' and ${schema.tenantMemberships.branchId} = ${lead.branchId}))`
          : eq(schema.tenantMemberships.role, "director"),
      )).limit(5);
    await Promise.allSettled(managers.map((manager) => publishNotification({
      capability: "lead_sla", tenantId: lead.tenantId, recipientUserId: manager.userId, leadId: lead.id, type: "lead_stale_stage",
      title: "Venda em potencial parada", message: `${lead.nome} (${lead.brokerName ?? "corretor"}) está há ${decision.awaitingBusinessDays} dias úteis sem resposta. A IA marcou como venda em potencial, então não vai para Perdido sozinho.`,
      url: `/leads/${lead.id}`, idempotencyKey: `stale-potential:${lead.id}:${manager.userId}:${lead.stageEnteredAt.toISOString()}`,
    })));
  }
}

/** Uma empresa: decide cada lead; em simulação só guarda a lista, ligada aplica. */
export async function runStaleStageForTenant(tenantId: string, mode: StaleStageMode, now = new Date()) {
  const candidates = await loadCandidates(tenantId);
  const items: StaleSimulationItem[] = [];
  let applied = 0;
  let failed = 0;
  for (const lead of candidates) {
    const decision = decide(lead, now);
    if (decision.action === "none") continue;
    if (mode === "simulate") {
      if (decision.action === "to_awaiting") items.push({ leadId: lead.id, name: lead.nome, brokerName: lead.brokerName, status: lead.status, action: "to_awaiting", businessDays: decision.silentBusinessDays });
      if (decision.action === "to_lost") items.push({ leadId: lead.id, name: lead.nome, brokerName: lead.brokerName, status: lead.status, action: "to_lost", businessDays: decision.awaitingBusinessDays });
      continue;
    }
    try {
      await applyDecision(lead, decision, now);
      applied += 1;
    } catch (error) {
      failed += 1;
      console.error("[stale-stage] apply_failed", { leadId: lead.id, action: decision.action, error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200) });
    }
  }
  if (mode === "simulate") {
    const simulation: StaleSimulation = {
      at: now.toISOString(),
      toAwaiting: items.filter((item) => item.action === "to_awaiting").length,
      toLost: items.filter((item) => item.action === "to_lost").length,
      items: items.slice(0, 300),
    };
    await setSystemSetting(staleStageSimulationKey(tenantId), JSON.stringify(simulation), now);
    return { tenantId, mode, simulated: items.length };
  }
  return { tenantId, mode, applied, failed };
}

/** Job diário (Coolify): todas as empresas com leads nas etapas olhadas. */
export async function runStaleStageJob(now = new Date()) {
  if ((await getFeatureFlag(FEATURE_FLAGS.STALE_STAGE_RULE)) === "false") return { skipped: true as const };
  const tenants = await getDatabase().selectDistinct({ tenantId: schema.leads.tenantId }).from(schema.leads)
    .where(sql`${schema.leads.status} in (${sql.join([...STALE_WATCH_STATUSES, "awaiting_reply"].map((status) => sql`${status}`), sql`, `)})`);
  const results = [];
  for (const { tenantId } of tenants) {
    const mode = parseStaleStageMode(await getSystemSetting(staleStageModeKey(tenantId)));
    if (mode === "off") continue;
    results.push(await runStaleStageForTenant(tenantId, mode, now));
  }
  return { skipped: false as const, results };
}

export async function getStaleStageState(tenantId: string): Promise<{ mode: StaleStageMode; simulation: StaleSimulation | null }> {
  const [modeValue, simulationValue] = await Promise.all([getSystemSetting(staleStageModeKey(tenantId)), getSystemSetting(staleStageSimulationKey(tenantId))]);
  let simulation: StaleSimulation | null = null;
  try {
    simulation = simulationValue ? JSON.parse(simulationValue) as StaleSimulation : null;
  } catch {
    simulation = null;
  }
  return { mode: parseStaleStageMode(modeValue), simulation };
}

export { STALE_RULE };

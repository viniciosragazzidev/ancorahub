import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import { findUnansweredInbound, hasRecoveryTurnBudget, RECOVERY_TURN_WORST_CASE_MS, recoveryMaxAgeMs } from "./unanswered-recovery-rules";

const LOCK_WAIT_MS = 45_000;
const LOCK_POLL_MS = 2_000;
/** Follow-ups a single customer message may cause: enough for a burst, never a loop. */
export const MAX_RECOVERY_DEPTH = 2;
const SWEEP_BUDGET_MS = 55_000;
const RECOVERY_FINISH_BUFFER_MS = 2_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadState(tenantId: string, leadId: string) {
  const db = getDatabase();
  const [lead] = await db.select({
    telefone: schema.leads.telefone,
    qualificationStatus: schema.leads.qualificationStatus,
    distributionStatus: schema.leads.distributionStatus,
  })
    .from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId), isNull(schema.leads.deletedAt))).limit(1);
  const [conversation] = await db.select({ status: schema.aiConversations.status, automationState: schema.aiConversations.automationState, lockVersion: schema.aiConversations.lockVersion })
    .from(schema.aiConversations).where(and(eq(schema.aiConversations.tenantId, tenantId), eq(schema.aiConversations.leadId, leadId)))
    .orderBy(desc(schema.aiConversations.updatedAt)).limit(1);
  const [config] = await db.select({ timeoutMinutes: schema.aiQualificationConfigs.timeoutMinutes })
    .from(schema.aiQualificationConfigs).where(eq(schema.aiQualificationConfigs.tenantId, tenantId)).limit(1);
  return { lead: lead ?? null, conversation: conversation ?? null, timeoutMinutes: config?.timeoutMinutes ?? 15 };
}

async function loadConversation(tenantId: string, leadId: string) {
  const [conversation] = await getDatabase().select({
    status: schema.aiConversations.status,
    automationState: schema.aiConversations.automationState,
    lockVersion: schema.aiConversations.lockVersion,
  }).from(schema.aiConversations)
    .where(and(eq(schema.aiConversations.tenantId, tenantId), eq(schema.aiConversations.leadId, leadId)))
    .orderBy(desc(schema.aiConversations.updatedAt)).limit(1);
  return conversation ?? null;
}

async function loadRecentMessages(tenantId: string, leadId: string) {
  return getDatabase().select({
    direction: schema.whatsappMessages.direction,
    body: schema.whatsappMessages.body,
    mediaKind: schema.whatsappMessages.mediaKind,
    provider: schema.whatsappMessages.provider,
    sentAt: schema.whatsappMessages.sentAt,
    messageId: schema.whatsappMessages.messageId,
    communicationChannelId: schema.whatsappMessages.communicationChannelId,
    providerStatus: schema.whatsappMessages.providerStatus,
  }).from(schema.whatsappMessages)
    .where(and(eq(schema.whatsappMessages.tenantId, tenantId), eq(schema.whatsappMessages.leadId, leadId)))
    .orderBy(desc(schema.whatsappMessages.sentAt)).limit(30);
}

/** Waits for another turn of this conversation to finish (its status leaves AI_ACTIVE or its lock stops moving). */
async function waitForTurnToFinish(tenantId: string, leadId: string) {
  const deadline = Date.now() + LOCK_WAIT_MS;
  let previous: number | null = null;
  while (Date.now() < deadline) {
    const conversation = await loadConversation(tenantId, leadId);
    if (!conversation || conversation.status !== "AI_ACTIVE") return;
    if (previous !== null && previous === conversation.lockVersion) return;
    previous = conversation.lockVersion;
    await sleep(LOCK_POLL_MS);
  }
}

/**
 * Answers the customer's unanswered messages of a qualification conversation, if any: one turn
 * that reads the whole burst. Safe to call more than once: it does nothing when an answer (AI or
 * person) already came after the last customer message.
 */
export async function answerLatestUnansweredInbound(input: {
  tenantId: string;
  leadId: string;
  depth: number;
  waitForLock?: boolean;
  /** Time for a newer message's own turn (debounce + claim) to start before deciding it was lost. */
  settleMs?: number;
  minAgeMs?: number;
  maxAgeMs?: number;
  reason: string;
}): Promise<{ status: "depth_exceeded" | "no_lead" | "nothing_pending" | "answered"; turn?: string }> {
  if (input.depth > MAX_RECOVERY_DEPTH) return { status: "depth_exceeded" };
  if (input.settleMs) await sleep(input.settleMs);
  if (input.waitForLock) await waitForTurnToFinish(input.tenantId, input.leadId);
  const { lead, conversation, timeoutMinutes } = await loadState(input.tenantId, input.leadId);
  if (!lead) return { status: "no_lead" };
  const messages = await loadRecentMessages(input.tenantId, input.leadId);
  const tenantMaxAgeMs = recoveryMaxAgeMs(timeoutMinutes);
  const maxAgeMs = Math.min(input.maxAgeMs ?? tenantMaxAgeMs, tenantMaxAgeMs);
  const pending = findUnansweredInbound({
    messages,
    conversation,
    qualificationStatus: lead.qualificationStatus,
    distributionStatus: lead.distributionStatus,
    timeoutMinutes,
    now: new Date(),
    minAgeMs: input.minAgeMs,
    maxAgeMs,
  });
  if (!pending) return { status: "nothing_pending" };

  // Timeout/status may change after the first read while the candidate is being loaded.
  // Re-read state and messages immediately before opening the recovery turn.
  const latestState = await loadState(input.tenantId, input.leadId);
  if (!latestState.lead) return { status: "no_lead" };
  const latestMaxAgeMs = Math.min(input.maxAgeMs ?? recoveryMaxAgeMs(latestState.timeoutMinutes), recoveryMaxAgeMs(latestState.timeoutMinutes));
  const latestPending = findUnansweredInbound({
    messages: await loadRecentMessages(input.tenantId, input.leadId),
    conversation: latestState.conversation,
    qualificationStatus: latestState.lead.qualificationStatus,
    distributionStatus: latestState.lead.distributionStatus,
    timeoutMinutes: latestState.timeoutMinutes,
    now: new Date(),
    minAgeMs: input.minAgeMs,
    maxAgeMs: latestMaxAgeMs,
  });
  if (!latestPending) return { status: "nothing_pending" };

  console.info("[ai-wpp] unanswered.recovered", { tenantId: input.tenantId, leadId: input.leadId, reason: input.reason, depth: input.depth });
  const { processInboundAiResponse } = await import("./conversation-state-machine");
  const result = await processInboundAiResponse({
    tenantId: input.tenantId,
    leadId: input.leadId,
    phone: latestState.lead.telefone ?? "",
    userMessageBody: latestPending.body,
    messageKind: latestPending.messageKind,
    communicationChannelId: latestPending.latest.communicationChannelId,
    providerMessageId: latestPending.latest.messageId,
    transport: "meta",
    skipDebounce: true,
    recoveryOnly: true,
  }, input.depth + 1);
  return { status: "answered", turn: String(result.status) };
}

const SWEEP_LIMIT = 6;

/**
 * Safety net (every run of the qualification-timeout job): a qualification conversation whose
 * last customer message has waited at least 90 s and less than the tenant timeout (capped at 30 min)
 * with no answer gets its turn now. Covers a restart or deploy in the middle of a turn.
 */
export async function runUnansweredInboundRecovery(input: { now?: Date; deadlineAt?: number } = {}) {
  const now = input.now ?? new Date();
  const startedAt = Date.now();
  const deadlineAt = Math.min(startedAt + SWEEP_BUDGET_MS, input.deadlineAt ?? Number.POSITIVE_INFINITY) - RECOVERY_FINISH_BUFFER_MS;
  if (!hasRecoveryTurnBudget(Date.now(), deadlineAt, RECOVERY_TURN_WORST_CASE_MS)) return { candidates: 0, answered: 0 };

  const db = getDatabase();
  const since = new Date(now.getTime() - 30 * 60_000).toISOString();
  const until = new Date(now.getTime() - 90_000).toISOString();
  const rows = await db.execute(sql`
    select c.tenant_id, c.lead_id
    from ai_conversations c
    join leads l on l.id = c.lead_id and l.tenant_id = c.tenant_id
    left join ai_qualification_configs cfg on cfg.tenant_id = c.tenant_id
    where c.status in ('WAITING_CUSTOMER', 'AI_ACTIVE')
      and coalesce(c.automation_state, 'AI_ACTIVE') = 'AI_ACTIVE'
      and l.deleted_at is null
      and l.qualification_status in ('pending', 'qualifying')
      and coalesce(l.distribution_status, '') <> 'manual_hold'
      and exists (
        select 1 from whatsapp_messages i
        where i.tenant_id = c.tenant_id and i.lead_id = c.lead_id and i.direction = 'incoming'
          and i.provider in ('meta_cloud', 'meta')
          and i.sent_at between ${since}::timestamptz and ${until}::timestamptz
          and i.sent_at > ${now.toISOString()}::timestamptz
            - (least(30, greatest(1, coalesce(cfg.timeout_minutes, 15)) - 1) * interval '1 minute')
          and not exists (
            select 1 from whatsapp_messages o
            where o.tenant_id = i.tenant_id and o.lead_id = i.lead_id and o.direction in ('outbound', 'outgoing') and o.sent_at > i.sent_at
              and o.provider_status is distinct from 'failed'
          )
      )
    limit ${SWEEP_LIMIT}
  `);
  const candidates = (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows ?? []) as Array<{ tenant_id: string; lead_id: string }>;
  let answered = 0;
  for (const candidate of candidates) {
    if (!hasRecoveryTurnBudget(Date.now(), deadlineAt, RECOVERY_TURN_WORST_CASE_MS)) break;
    const result = await answerLatestUnansweredInbound({
      tenantId: candidate.tenant_id, leadId: candidate.lead_id, depth: 0, minAgeMs: 90_000, reason: "sweep",
    }).catch((error) => {
      console.error("[ai-wpp] unanswered.recovery_failed", { leadId: candidate.lead_id, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
      return null;
    });
    if (result?.status === "answered") answered += 1;
  }
  return { candidates: candidates.length, answered };
}

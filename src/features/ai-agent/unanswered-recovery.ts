import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import { findUnansweredInbound } from "./unanswered-recovery-rules";

const LOCK_WAIT_MS = 45_000;
const LOCK_POLL_MS = 2_000;
/** Follow-ups a single customer message may cause: enough for a burst, never a loop. */
export const MAX_RECOVERY_DEPTH = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadState(tenantId: string, leadId: string) {
  const db = getDatabase();
  const [lead] = await db.select({ telefone: schema.leads.telefone, qualificationStatus: schema.leads.qualificationStatus })
    .from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId), isNull(schema.leads.deletedAt))).limit(1);
  const [conversation] = await db.select({ status: schema.aiConversations.status, automationState: schema.aiConversations.automationState, lockVersion: schema.aiConversations.lockVersion })
    .from(schema.aiConversations).where(and(eq(schema.aiConversations.tenantId, tenantId), eq(schema.aiConversations.leadId, leadId)))
    .orderBy(desc(schema.aiConversations.updatedAt)).limit(1);
  return { lead: lead ?? null, conversation: conversation ?? null };
}

/** Waits for another turn of this conversation to finish (its status leaves AI_ACTIVE or its lock stops moving). */
async function waitForTurnToFinish(tenantId: string, leadId: string) {
  const deadline = Date.now() + LOCK_WAIT_MS;
  let previous: number | null = null;
  while (Date.now() < deadline) {
    const { conversation } = await loadState(tenantId, leadId);
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
  const { lead, conversation } = await loadState(input.tenantId, input.leadId);
  if (!lead) return { status: "no_lead" };
  const messages = await getDatabase().select({
    direction: schema.whatsappMessages.direction,
    body: schema.whatsappMessages.body,
    mediaKind: schema.whatsappMessages.mediaKind,
    provider: schema.whatsappMessages.provider,
    sentAt: schema.whatsappMessages.sentAt,
    messageId: schema.whatsappMessages.messageId,
    communicationChannelId: schema.whatsappMessages.communicationChannelId,
    providerStatus: schema.whatsappMessages.providerStatus,
  }).from(schema.whatsappMessages)
    .where(and(eq(schema.whatsappMessages.tenantId, input.tenantId), eq(schema.whatsappMessages.leadId, input.leadId)))
    .orderBy(desc(schema.whatsappMessages.sentAt)).limit(30);
  const pending = findUnansweredInbound({
    messages, conversation, qualificationStatus: lead.qualificationStatus, now: new Date(),
    minAgeMs: input.minAgeMs, maxAgeMs: input.maxAgeMs,
  });
  if (!pending) return { status: "nothing_pending" };

  console.info("[ai-wpp] unanswered.recovered", { tenantId: input.tenantId, leadId: input.leadId, reason: input.reason, depth: input.depth });
  const { processInboundAiResponse } = await import("./conversation-state-machine");
  const result = await processInboundAiResponse({
    tenantId: input.tenantId,
    leadId: input.leadId,
    phone: lead.telefone,
    userMessageBody: pending.body,
    messageKind: pending.messageKind,
    communicationChannelId: pending.latest.communicationChannelId,
    providerMessageId: pending.latest.messageId,
    transport: "meta",
    skipDebounce: true,
  }, input.depth + 1);
  return { status: "answered", turn: String(result.status) };
}

const SWEEP_LIMIT = 6;
const SWEEP_BUDGET_MS = 35_000;

/**
 * Safety net (every run of the qualification-timeout job): a qualification conversation whose
 * last customer message has waited between 90 s and 30 min with no answer gets its turn now.
 * Covers what the in-process follow-up cannot: a restart or deploy in the middle of a turn.
 */
export async function runUnansweredInboundRecovery(now = new Date()) {
  const db = getDatabase();
  const since = new Date(now.getTime() - 30 * 60_000).toISOString();
  const until = new Date(now.getTime() - 90_000).toISOString();
  const rows = await db.execute(sql`
    select c.tenant_id, c.lead_id
    from ai_conversations c
    join leads l on l.id = c.lead_id and l.tenant_id = c.tenant_id
    where c.status in ('WAITING_CUSTOMER', 'AI_ACTIVE')
      and coalesce(c.automation_state, 'AI_ACTIVE') = 'AI_ACTIVE'
      and l.deleted_at is null
      and coalesce(l.qualification_status, 'pending') in ('pending', 'qualifying')
      and exists (
        select 1 from whatsapp_messages i
        where i.tenant_id = c.tenant_id and i.lead_id = c.lead_id and i.direction = 'incoming'
          and i.provider in ('meta_cloud', 'meta')
          and i.sent_at between ${since}::timestamptz and ${until}::timestamptz
          and not exists (
            select 1 from whatsapp_messages o
            where o.tenant_id = i.tenant_id and o.lead_id = i.lead_id and o.direction in ('outbound', 'outgoing') and o.sent_at > i.sent_at
              and o.provider_status is distinct from 'failed'
          )
      )
    limit ${SWEEP_LIMIT}
  `);
  const candidates = (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows ?? []) as Array<{ tenant_id: string; lead_id: string }>;
  const deadline = Date.now() + SWEEP_BUDGET_MS;
  let answered = 0;
  for (const candidate of candidates) {
    if (Date.now() > deadline) break;
    const result = await answerLatestUnansweredInbound({
      tenantId: candidate.tenant_id, leadId: candidate.lead_id, depth: 0, minAgeMs: 90_000, maxAgeMs: 30 * 60_000, reason: "sweep",
    }).catch((error) => {
      console.error("[ai-wpp] unanswered.recovery_failed", { leadId: candidate.lead_id, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
      return null;
    });
    if (result?.status === "answered") answered += 1;
  }
  return { candidates: candidates.length, answered };
}

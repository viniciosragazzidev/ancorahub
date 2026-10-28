import "server-only";

import { and, desc, gt, inArray, isNotNull, max, notInArray, sql } from "drizzle-orm";

import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { withJobLease } from "@/shared/db/job-lease";

import { analyzeLeadConversation } from "./analyzer";
import { getAiStageMode } from "./stage-mode";

/** Leads analysed per run (every minute since 28/10): bounds the AI bill and the run time. */
const MAX_LEADS_PER_RUN = 40;
/** Analyses at the same time inside one run. */
const CONCURRENCY = 3;
/** 1 minute after the last message (Vinicios, 28/10), the same wait as the webhook debounce. */
const QUIET_MS = 60_000;
/** Only recent conversations; older ones are analysed when someone opens the lead. */
const LOOKBACK_MS = 3 * 24 * 60 * 60_000;
/** The job runs every minute: a run ends before the next one starts. */
const TIME_BUDGET_MS = 50_000;

/**
 * Durable trigger of the conversation analysis (Coolify, every 10 minutes):
 * leads with WhatsApp messages newer than their last analysis. Covers every
 * message source (WAHA, Meta, OpenWA, sent from the CRM) and the in-memory
 * debounce lost on a deploy or restart.
 */
export async function runConversationReconcileJob() {
  if ((await getSystemSetting(FEATURE_FLAGS.CONVERSATION_INTELLIGENCE.key)) === "false") {
    return { skipped: "disabled" as const };
  }
  // One run at a time: a slow run (AI timeouts) must not overlap the next one.
  const lease = await withJobLease("conversation-intelligence", TIME_BUDGET_MS + 60_000, runReconcile);
  return lease.acquired ? lease.value : { skipped: "running" as const };
}

async function runReconcile() {

  const db = getDatabase();
  const now = Date.now();
  const lastMessageAt = max(schema.whatsappMessages.sentAt);
  const recent = await db
    .select({ leadId: schema.whatsappMessages.leadId, tenantId: schema.whatsappMessages.tenantId, lastMessageAt })
    .from(schema.whatsappMessages)
    .where(and(isNotNull(schema.whatsappMessages.leadId), gt(schema.whatsappMessages.sentAt, new Date(now - LOOKBACK_MS))))
    .groupBy(schema.whatsappMessages.leadId, schema.whatsappMessages.tenantId)
    .having(sql`max(${schema.whatsappMessages.sentAt}) < ${new Date(now - QUIET_MS).toISOString()}::timestamptz`)
    .orderBy(desc(lastMessageAt))
    .limit(400);
  if (!recent.length) return { analyzed: 0, moved: 0, candidates: 0 };

  const leads = await db
    .select({
      id: schema.leads.id,
      tenantId: schema.leads.tenantId,
      lastAnalyzedAt: sql<string | null>`${schema.leads.qualificationDetails}->>'aiLastAnalyzedAt'`,
    })
    .from(schema.leads)
    .where(and(
      inArray(schema.leads.id, recent.map((row) => row.leadId!)),
      notInArray(schema.leads.status, ["converted", "lost"]),
    ));
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));

  const pending = recent.filter((row) => {
    const lead = leadById.get(row.leadId!);
    if (!lead || lead.tenantId !== row.tenantId || !row.lastMessageAt) return false;
    const analyzedAt = lead.lastAnalyzedAt ? Date.parse(lead.lastAnalyzedAt) : 0;
    return !(analyzedAt >= new Date(row.lastMessageAt).getTime());
  });

  const modeByTenant = new Map<string, Awaited<ReturnType<typeof getAiStageMode>>>();
  let analyzed = 0;
  let moved = 0;
  // AI failures show in the job answer (Coolify log), not only in the server console.
  let failed = 0;
  let lastFailure: string | undefined;
  const queue: typeof pending = [];
  for (const row of pending) {
    if (queue.length >= MAX_LEADS_PER_RUN) break;
    if (!modeByTenant.has(row.tenantId)) modeByTenant.set(row.tenantId, await getAiStageMode(row.tenantId));
    // A company that turned the stage IA off still gets the diagnosis when the lead is opened.
    if (modeByTenant.get(row.tenantId) !== "off") queue.push(row);
  }
  const analyzeOne = async (row: (typeof pending)[number]) => {
    try {
      const result = await analyzeLeadConversation(row.leadId!, row.tenantId);
      if (result.analyzed) analyzed += 1;
      else if (result.reason?.startsWith("Falha")) { failed += 1; lastFailure = result.reason.slice(0, 200); }
      if (result.policyResult?.action === "AUTO_TRANSITION") moved += 1;
    } catch (error) {
      console.error("[conversation-reconcile] lead failed", row.leadId, error instanceof Error ? error.message.slice(0, 200) : error);
    }
  };
  for (let index = 0; index < queue.length; index += CONCURRENCY) {
    if (Date.now() - now > TIME_BUDGET_MS) break;
    await Promise.all(queue.slice(index, index + CONCURRENCY).map(analyzeOne));
  }
  return { analyzed, moved, failed, candidates: pending.length, ...(lastFailure ? { lastFailure } : {}) };
}

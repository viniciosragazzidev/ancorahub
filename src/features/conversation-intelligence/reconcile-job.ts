import "server-only";

import { and, desc, gt, inArray, isNotNull, max, notInArray, sql } from "drizzle-orm";

import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

import { analyzeLeadConversation } from "./analyzer";
import { getAiStageMode } from "./stage-mode";

/** Leads analysed per run (every 10 min): bounds the AI bill and the run time. */
const MAX_LEADS_PER_RUN = 20;
/** Same wait as the webhook debounce: the customer may still be typing. */
const QUIET_MS = 2 * 60_000;
/** Only recent conversations; older ones are analysed when someone opens the lead. */
const LOOKBACK_MS = 3 * 24 * 60 * 60_000;
const TIME_BUDGET_MS = 100_000;

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
  for (const row of pending) {
    if (analyzed >= MAX_LEADS_PER_RUN || Date.now() - now > TIME_BUDGET_MS) break;
    if (!modeByTenant.has(row.tenantId)) modeByTenant.set(row.tenantId, await getAiStageMode(row.tenantId));
    // A company that turned the stage IA off still gets the diagnosis when the lead is opened.
    if (modeByTenant.get(row.tenantId) === "off") continue;
    try {
      const result = await analyzeLeadConversation(row.leadId!, row.tenantId);
      if (result.analyzed) analyzed += 1;
      if (result.policyResult?.action === "AUTO_TRANSITION") moved += 1;
    } catch (error) {
      console.error("[conversation-reconcile] lead failed", row.leadId, error instanceof Error ? error.message.slice(0, 200) : error);
    }
  }
  return { analyzed, moved, candidates: pending.length };
}

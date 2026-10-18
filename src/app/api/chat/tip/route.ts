import { and, desc, eq, inArray } from "drizzle-orm";
import { after, NextResponse } from "next/server";

import { getCachedBrokerWorkspaceData } from "@/features/broker-workspace/chat/chat-rail-data";
import { intelligenceLabel, intelligenceTips, isOutboundMessage, nextStepText, readLeadIntelligence } from "@/features/broker-workspace/chat/intelligence";
import { pickBrokerTip } from "@/features/broker-workspace/tips/pick-tip";
import { requestLeadConversationAnalysis } from "@/features/conversation-intelligence/trigger";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export const dynamic = "force-dynamic";

const STALE_ANALYSIS_MS = 6 * 60 * 60_000;

/**
 * The quick tip that pops up for the broker (a GET: also works in "Ver como").
 * Picked from the broker's own queue; the conversation analysis, when it exists,
 * gives the words. A missing or old analysis is requested after the response.
 */
export async function GET() {
  const context = await getRequiredTenantContext().catch(() => null);
  if (!context) return NextResponse.json({ tip: null }, { status: 401 });
  if (context.role !== "broker") return NextResponse.json({ tip: null });
  try {
    const data = await getCachedBrokerWorkspaceData();
    const leadIds = data.queue.filter((lead) => lead.nextAction).slice(0, 12).map((lead) => lead.id);
    const rows = leadIds.length
      ? await getDatabase().select({ id: schema.leads.id, details: schema.leads.qualificationDetails })
        .from(schema.leads)
        .where(and(eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.corretorId, context.userId), inArray(schema.leads.id, leadIds)))
      : [];
    const intelligence = new Map(rows.map((row) => [row.id, readLeadIntelligence(row.details)]));
    const aiStep = new Map<string, string>();
    for (const [id, ai] of intelligence) {
      const step = nextStepText(ai.nextBestAction);
      if (step) aiStep.set(id, step.replace(/\.$/, ""));
    }
    const now = new Date();
    const tip = pickBrokerTip({ queue: data.queue, aiStep, now });
    const ai = tip ? intelligence.get(tip.leadId) : null;
    if (tip) {
      // What is happening now: the client's last words, the stage and one hint the tip does not already say.
      const recent = await getDatabase().select({ body: schema.whatsappMessages.body, direction: schema.whatsappMessages.direction })
        .from(schema.whatsappMessages)
        .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), eq(schema.whatsappMessages.leadId, tip.leadId)))
        .orderBy(desc(schema.whatsappMessages.sentAt))
        .limit(8);
      const lastClient = recent.find((message) => message.body?.trim() && !isOutboundMessage(message.direction));
      const insight = ai ? intelligenceTips(ai).find((text) => !/esperando você|está com ele/.test(text)) ?? null : null;
      tip.live = { ...tip.live, quote: lastClient?.body?.trim().slice(0, 160) ?? null, stage: intelligenceLabel.stage(ai?.conversationStage), insight };
    }
    // The lead of the tip without a fresh analysis: read the conversation now, for the next tips and Insights.
    const stale = !ai?.lastAnalyzedAt || now.getTime() - Date.parse(ai.lastAnalyzedAt) > STALE_ANALYSIS_MS;
    if (tip && stale) after(() => requestLeadConversationAnalysis(tip.leadId, context.tenantId, context.userId).then(() => undefined));
    return NextResponse.json({ tip }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[chat-tip] failed", error);
    return NextResponse.json({ tip: null });
  }
}

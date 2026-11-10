import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";

import { getPreferredMetaCloudChannel, sendMetaCloudChannelText } from "@/features/communication-channels/service";
import { resolveCanonicalWhatsAppDestination } from "@/features/communication-channels/phone-resolution";
import { getTurboSettings } from "@/features/qualification-turbo/service";
import { enqueueWahaAiReply } from "@/features/waha-cadence/service";
import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";

import { decideSilenceFollowUp, silenceFollowUpMessageId, type SilenceFollowUpChannel, type SilenceFollowUpSkipReason } from "./silence-follow-up-rules";

/** Leads looked at per run (every 2 minutes); the window is a few minutes wide, so a run sees few. */
const SWEEP_LIMIT = 40;
const SWEEP_BUDGET_MS = 20_000;
const SEND_RESERVE_MS = 8_000;

export type SilenceFollowUpSweepResult = { candidates: number; sent: number; failed: number; skipped: Partial<Record<SilenceFollowUpSkipReason, number>> };

async function sendThrough(channel: SilenceFollowUpChannel, input: { tenantId: string; leadId: string; phone: string; body: string; wahaRunId: string | null }) {
  if (channel === "waha") {
    if (!input.wahaRunId) throw new Error("waha_run_missing");
    const messageId = await enqueueWahaAiReply({ tenantId: input.tenantId, runId: input.wahaRunId, body: input.body });
    return { messageId, communicationChannelId: null as string | null };
  }
  const metaChannel = await getPreferredMetaCloudChannel({ tenantId: input.tenantId, leadId: input.leadId, customerPhone: input.phone });
  if (!metaChannel || "blocked" in metaChannel) throw new Error("meta_channel_unavailable");
  const to = (await resolveCanonicalWhatsAppDestination({ tenantId: input.tenantId, phone: input.phone, leadId: input.leadId })) ?? input.phone;
  const sent = await sendMetaCloudChannelText({ channel: metaChannel, to, body: input.body });
  if (!sent.messageId) throw new Error("meta_not_sent");
  return { messageId: sent.messageId, communicationChannelId: metaChannel.id };
}

/**
 * One light follow-up to whoever stopped answering mid-qualification (rules in silence-follow-up-rules.ts).
 * Runs inside the qualification-timeout job (Coolify, every 2 min), after the timeout sweep, which keeps the
 * precedence over the cold boundary. The message row has a fixed id per lead: it is written before sending,
 * so two overlapping runs never send twice, and a failed send is not retried.
 */
export async function runSilenceFollowUpSweep(input: { now?: Date; deadlineAt?: number } = {}): Promise<SilenceFollowUpSweepResult> {
  const now = input.now ?? new Date();
  // Leaves room for a send in flight before the job's own deadline.
  const stopAt = Math.min(Date.now() + SWEEP_BUDGET_MS, (input.deadlineAt ?? Number.POSITIVE_INFINITY) - SEND_RESERVE_MS);
  const result: SilenceFollowUpSweepResult = { candidates: 0, sent: 0, failed: 0, skipped: {} };
  if (Date.now() >= stopAt) return result;
  const db = getDatabase();

  // Cheap SQL prefilter: starts from the AI messages of the last hour (index tenant + sent_at), then keeps open
  // qualifications with no broker, the AI still talking and no follow-up yet. The full rules run in
  // decideSilenceFollowUp.
  const rows = await db.execute(sql`
    with recent as (
      select distinct o.tenant_id, o.lead_id
      from tenants t
      join whatsapp_messages o on o.tenant_id = t.id
      where t.status = 'active' and o.lead_id is not null
        and o.sent_at between ${new Date(now.getTime() - 60 * 60_000).toISOString()}::timestamptz
          and ${new Date(now.getTime() - 5 * 60_000).toISOString()}::timestamptz
        and o.direction = 'outbound' and o.sender_role = 'assistant'
    )
    select l.id as lead_id, l.tenant_id, cfg.timeout_minutes
    from recent r
    join leads l on l.id = r.lead_id and l.tenant_id = r.tenant_id
    join lateral (
      select c.status, c.automation_state from ai_conversations c
      where c.tenant_id = l.tenant_id and c.lead_id = l.id
      order by c.updated_at desc limit 1
    ) conv on true
    left join ai_qualification_configs cfg on cfg.tenant_id = l.tenant_id
    where l.deleted_at is null and l.archived_at is null and l.corretor_id is null
      and l.qualification_status in ('pending', 'qualifying')
      and l.status not in ('lost', 'converted')
      and coalesce(l.distribution_status, '') <> 'manual_hold'
      and l.distribution_removed_at is null
      and conv.status in ('AI_ACTIVE', 'WAITING_CUSTOMER')
      and coalesce(conv.automation_state, 'AI_ACTIVE') = 'AI_ACTIVE'
      and not exists (select 1 from whatsapp_messages f where f.id = ${silenceFollowUpMessageId("")} || l.id)
    limit ${SWEEP_LIMIT}
  `);
  const candidates = (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows ?? []) as Array<{ lead_id: string; tenant_id: string; timeout_minutes: number | null }>;
  result.candidates = candidates.length;

  const settingsCache = new Map<string, Awaited<ReturnType<typeof getTurboSettings>>>();
  for (const candidate of candidates) {
    if (Date.now() >= stopAt) break;
    const tenantId = candidate.tenant_id;
    const leadId = candidate.lead_id;
    try {
      let settings = settingsCache.get(tenantId);
      if (!settings) {
        settings = await getTurboSettings(tenantId);
        settingsCache.set(tenantId, settings);
      }
      if (!settings.silenceFollowUp) {
        result.skipped.disabled = (result.skipped.disabled ?? 0) + 1;
        continue;
      }

      const [lead] = await db.select({
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        corretorId: schema.leads.corretorId,
        status: schema.leads.status,
        qualificationStatus: schema.leads.qualificationStatus,
        distributionStatus: schema.leads.distributionStatus,
        distributionRemovedAt: schema.leads.distributionRemovedAt,
        deletedAt: schema.leads.deletedAt,
        archivedAt: schema.leads.archivedAt,
      }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId))).limit(1);
      if (!lead?.telefone) continue;
      const [conversation] = await db.select({
        id: schema.aiConversations.id,
        status: schema.aiConversations.status,
        automationState: schema.aiConversations.automationState,
        optOutAt: schema.aiConversations.optOutAt,
        wrongNumberAt: schema.aiConversations.wrongNumberAt,
      }).from(schema.aiConversations)
        .where(and(eq(schema.aiConversations.tenantId, tenantId), eq(schema.aiConversations.leadId, leadId)))
        .orderBy(desc(schema.aiConversations.updatedAt)).limit(1);
      const messages = await db.select({
        id: schema.whatsappMessages.id,
        direction: schema.whatsappMessages.direction,
        senderRole: schema.whatsappMessages.senderRole,
        body: schema.whatsappMessages.body,
        provider: schema.whatsappMessages.provider,
        providerStatus: schema.whatsappMessages.providerStatus,
        sentAt: schema.whatsappMessages.sentAt,
      }).from(schema.whatsappMessages)
        .where(and(eq(schema.whatsappMessages.tenantId, tenantId), eq(schema.whatsappMessages.leadId, leadId)))
        .orderBy(desc(schema.whatsappMessages.sentAt)).limit(30);
      const [wahaRun] = await db.select({ id: schema.wahaCadenceRuns.id }).from(schema.wahaCadenceRuns)
        .where(and(eq(schema.wahaCadenceRuns.tenantId, tenantId), eq(schema.wahaCadenceRuns.recipientType, "lead"), eq(schema.wahaCadenceRuns.recipientId, leadId)))
        .orderBy(desc(schema.wahaCadenceRuns.createdAt)).limit(1);

      const decision = decideSilenceFollowUp({
        now,
        enabled: settings.silenceFollowUp,
        channelSetting: settings.silenceFollowUpChannel,
        timeoutMinutes: candidate.timeout_minutes,
        leadName: lead.nome,
        lead,
        conversation: conversation ?? null,
        messages: messages.map((message) => ({ ...message, sentAt: message.sentAt ?? new Date(0) })),
        wahaAvailable: Boolean(wahaRun),
      });
      if (decision.action === "skip") {
        result.skipped[decision.reason] = (result.skipped[decision.reason] ?? 0) + 1;
        continue;
      }

      // Claim: the fixed id makes this the only follow-up the lead ever gets.
      const messageRowId = silenceFollowUpMessageId(leadId);
      const [claimed] = await db.insert(schema.whatsappMessages).values({
        id: messageRowId,
        tenantId,
        leadId,
        conversationId: conversation?.id ?? null,
        senderRole: "assistant",
        provider: decision.channel,
        phone: lead.telefone,
        direction: "outbound",
        body: decision.text,
        sentAt: new Date(),
      }).onConflictDoNothing().returning({ id: schema.whatsappMessages.id });
      if (!claimed) {
        result.skipped.already_sent = (result.skipped.already_sent ?? 0) + 1;
        continue;
      }

      let delivered: { channel: SilenceFollowUpChannel; messageId: string; communicationChannelId: string | null } | null = null;
      for (const channel of [decision.channel, decision.fallback].filter((value): value is SilenceFollowUpChannel => Boolean(value))) {
        try {
          const sent = await sendThrough(channel, { tenantId, leadId, phone: lead.telefone, body: decision.text, wahaRunId: wahaRun?.id ?? null });
          delivered = { channel, ...sent };
          break;
        } catch (error) {
          console.warn("[silence-follow-up] channel_failed", { tenantId, leadId, channel, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
        }
      }

      await db.update(schema.whatsappMessages).set(delivered
        ? { providerStatus: "sent", provider: delivered.channel, messageId: delivered.messageId, communicationChannelId: delivered.communicationChannelId }
        : { providerStatus: "failed" })
        .where(and(eq(schema.whatsappMessages.id, messageRowId), eq(schema.whatsappMessages.tenantId, tenantId)));
      await db.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: await resolveSystemUserId(tenantId),
        entidade: "lead",
        entidadeId: leadId,
        acao: delivered ? `qualification.silence_follow_up_sent:${delivered.channel}` : "qualification.silence_follow_up_failed",
        createdAt: new Date(),
      }).catch(() => undefined);
      if (delivered) {
        result.sent += 1;
        console.info("[silence-follow-up] sent", { tenantId, leadId, channel: delivered.channel });
      } else {
        result.failed += 1;
      }
    } catch (error) {
      result.failed += 1;
      console.error("[silence-follow-up] lead_failed", { tenantId, leadId, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    }
  }
  return result;
}

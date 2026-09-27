import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, isNotNull, lte, or, sql } from "drizzle-orm";

import { getMessageEventByPurpose } from "@/features/communication-channels/message-event-catalog";
import { getTenantChannelRouting, TENANT_CHANNEL_CONNECTED_STATUSES } from "@/features/waha-cadence/tenant-channel-routing";
import { renderTenantChannelMessage } from "@/features/waha-cadence/tenant-channel-routing-rules";
import { getDatabase, schema } from "@/shared/db";
import { effectiveNoticeSetting, TEAM_NOTICES, teamNoticeByKey, type TeamNotice, type TeamNoticeSetting } from "./catalog";
import type { CompanyNumberState } from "./decision";
import { DELIVERY_LIMITS, evaluateDeliveryGuard, localDateKey, type GuardResult } from "./guard";

/** Effective setting per notice: stored row, else the legacy company-number routing, else the catalog default. */
export async function getTeamNoticeSettings(tenantId: string): Promise<Map<string, TeamNoticeSetting>> {
  const [rows, legacy] = await Promise.all([
    getDatabase().select().from(schema.teamNoticeSettings).where(eq(schema.teamNoticeSettings.tenantId, tenantId)),
    getTenantChannelRouting(tenantId),
  ]);
  const stored = new Map(rows.map((row) => [row.noticeKey, row]));
  const result = new Map<string, TeamNoticeSetting>();
  for (const notice of TEAM_NOTICES) {
    const row = stored.get(notice.key);
    const legacyMessage = (legacy.events as Record<string, string | undefined>)[notice.key] ?? null;
    result.set(notice.key, effectiveNoticeSetting(notice, row
      ? { enabled: row.enabled, channel: row.channel, freeMessageId: row.freeMessageId }
      : { freeMessageId: legacyMessage }));
  }
  return result;
}

export async function getTeamNoticeSetting(tenantId: string, notice: TeamNotice) {
  return (await getTeamNoticeSettings(tenantId)).get(notice.key) ?? effectiveNoticeSetting(notice, null);
}

/** The tenant's company WAHA number (the newest), connected or not. */
export async function getCompanyNumberState(tenantId: string): Promise<(NonNullable<CompanyNumberState> & { createdAt: Date; lastSentAt: Date | null }) | null> {
  const [number] = await getDatabase().select({
    id: schema.wahaNumbers.id,
    status: schema.wahaNumbers.status,
    pausedUntil: schema.wahaNumbers.pausedUntil,
    createdAt: schema.wahaNumbers.createdAt,
    lastSentAt: schema.wahaNumbers.lastSentAt,
  }).from(schema.wahaNumbers)
    .where(and(eq(schema.wahaNumbers.tenantId, tenantId), eq(schema.wahaNumbers.scope, "tenant")))
    .orderBy(desc(schema.wahaNumbers.createdAt))
    .limit(1);
  if (!number) return null;
  return { id: number.id, connected: TENANT_CHANNEL_CONNECTED_STATUSES.includes(number.status), pausedUntil: number.pausedUntil, createdAt: number.createdAt, lastSentAt: number.lastSentAt };
}

/** The text a team notice carries through the company number: the chosen free message, else the built-in wording. */
export async function renderTeamNoticeText(input: { tenantId: string; notice: TeamNotice; setting: TeamNoticeSetting; variables: readonly string[]; builtIn: string }) {
  if (input.setting.freeMessageId) {
    const [message] = await getDatabase().select({ content: schema.messageTemplates.content }).from(schema.messageTemplates)
      .where(and(eq(schema.messageTemplates.id, input.setting.freeMessageId), eq(schema.messageTemplates.tenantId, input.tenantId), eq(schema.messageTemplates.active, true)))
      .limit(1);
    const event = getMessageEventByPurpose(input.notice.purpose);
    const rendered = message && event ? renderTenantChannelMessage(event, message.content, input.variables) : "";
    if (rendered) return rendered;
  }
  return input.builtIn.trim();
}

/** Stable value in [0, 1) per row: the spacing jitter must not change between two checks of the same message. */
function stableFraction(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return (hash % 10_000) / 10_000;
}

/** Counts the guard needs for one outbox row. Only notices already sent count. */
export async function evaluateNoticeRow(row: {
  id: string;
  tenantId: string;
  recipientId: string | null;
  noticeKey: string;
  variables: unknown;
  createdAt: Date;
  wahaNumberId: string | null;
}, channel: "company_number" | "meta", now = new Date()): Promise<GuardResult> {
  const notice = teamNoticeByKey(row.noticeKey);
  if (!notice) return { kind: "now" };
  const db = getDatabase();
  const dayAgo = new Date(now.getTime() - 24 * 3_600_000);
  const hourAgo = new Date(now.getTime() - 3_600_000);
  const today = localDateKey(now);

  const recipientRows = row.recipientId && notice.class !== "critical"
    ? await db.select({ sentAt: schema.whatsappOutboundMessages.sentAt, noticeKey: schema.whatsappOutboundMessages.noticeKey, variables: schema.whatsappOutboundMessages.variables })
      .from(schema.whatsappOutboundMessages)
      .where(and(
        eq(schema.whatsappOutboundMessages.tenantId, row.tenantId),
        eq(schema.whatsappOutboundMessages.recipientId, row.recipientId),
        isNotNull(schema.whatsappOutboundMessages.sentAt),
        gte(schema.whatsappOutboundMessages.sentAt, dayAgo),
      ))
    : [];
  const nonCritical = recipientRows.filter((item) => item.noticeKey && teamNoticeByKey(item.noticeKey)?.class !== "critical");
  const sameSubject = JSON.stringify(row.variables ?? []);
  const lastSentAt = recipientRows.reduce<Date | null>((latest, item) => (item.sentAt && (!latest || item.sentAt > latest) ? item.sentAt : latest), null);

  let number: { lastSentAt: Date | null; sentLastHour: number; sentToday: number; connectedAt: Date | null } | null = null;
  if (channel === "company_number" && row.wahaNumberId) {
    const [numberRow] = await db.select({ lastSentAt: schema.wahaNumbers.lastSentAt, createdAt: schema.wahaNumbers.createdAt }).from(schema.wahaNumbers).where(eq(schema.wahaNumbers.id, row.wahaNumberId)).limit(1);
    const sent = await db.select({ sentAt: schema.whatsappOutboundMessages.sentAt }).from(schema.whatsappOutboundMessages)
      .where(and(eq(schema.whatsappOutboundMessages.wahaNumberId, row.wahaNumberId), isNotNull(schema.whatsappOutboundMessages.sentAt), gte(schema.whatsappOutboundMessages.sentAt, dayAgo)));
    number = {
      lastSentAt: numberRow?.lastSentAt ?? null,
      sentLastHour: sent.filter((item) => item.sentAt! >= hourAgo).length,
      sentToday: sent.filter((item) => localDateKey(item.sentAt!) === today).length,
      connectedAt: numberRow?.createdAt ?? null,
    };
  }

  return evaluateDeliveryGuard({
    noticeClass: notice.class,
    now,
    createdAt: row.createdAt,
    channel,
    random: stableFraction(row.id),
    recipient: {
      lastSentAt,
      sentLastHour: nonCritical.filter((item) => item.sentAt! >= hourAgo).length,
      sentToday: nonCritical.filter((item) => localDateKey(item.sentAt!) === today).length,
      remindersToday: nonCritical.filter((item) => teamNoticeByKey(item.noticeKey!)?.class === "reminder" && localDateKey(item.sentAt!) === today).length,
      duplicateRecently: nonCritical.some((item) => item.noticeKey === row.noticeKey && item.sentAt! >= new Date(now.getTime() - DELIVERY_LIMITS.recipient.duplicateWindowMs) && JSON.stringify(item.variables ?? []) === sameSubject),
    },
    number,
  });
}

/**
 * Takes the company number's sending slot: succeeds only when the last send
 * was at least `gapMs` ago, atomically, so two workers never send glued together.
 */
export async function reserveCompanyNumberSlot(wahaNumberId: string, gapMs: number, now = new Date()) {
  const [taken] = await getDatabase().update(schema.wahaNumbers)
    .set({ lastSentAt: now })
    .where(and(
      eq(schema.wahaNumbers.id, wahaNumberId),
      or(sql`${schema.wahaNumbers.lastSentAt} IS NULL`, lte(schema.wahaNumbers.lastSentAt, new Date(now.getTime() - gapMs))),
    ))
    .returning({ id: schema.wahaNumbers.id });
  return Boolean(taken);
}

export async function recordCompanyNumberSuccess(wahaNumberId: string) {
  await getDatabase().update(schema.wahaNumbers).set({ consecutiveFailures: 0, updatedAt: new Date() }).where(eq(schema.wahaNumbers.id, wahaNumberId));
}

/**
 * Circuit breaker: after N failures in a row the number is paused for a while;
 * every notice then goes by Meta and the directors are told once.
 */
export async function recordCompanyNumberFailure(wahaNumberId: string, now = new Date()) {
  const db = getDatabase();
  const limits = DELIVERY_LIMITS.companyNumber;
  const [updated] = await db.update(schema.wahaNumbers)
    .set({ consecutiveFailures: sql`${schema.wahaNumbers.consecutiveFailures} + 1`, updatedAt: now })
    .where(eq(schema.wahaNumbers.id, wahaNumberId))
    .returning({ failures: schema.wahaNumbers.consecutiveFailures, tenantId: schema.wahaNumbers.tenantId, pausedUntil: schema.wahaNumbers.pausedUntil });
  if (!updated || updated.failures < limits.breakerFailures) return { paused: false };
  if (updated.pausedUntil && updated.pausedUntil > now) return { paused: true };
  const pausedUntil = new Date(now.getTime() + limits.breakerPauseMs);
  await db.update(schema.wahaNumbers).set({ pausedUntil, consecutiveFailures: 0, updatedAt: now }).where(eq(schema.wahaNumbers.id, wahaNumberId));
  if (updated.tenantId) {
    const directors = await db.select({ userId: schema.tenantMemberships.userId }).from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, updated.tenantId), inArray(schema.tenantMemberships.role, ["director"]), eq(schema.tenantMemberships.status, "active")));
    for (const director of directors) {
      await db.insert(schema.notifications).values({
        id: randomUUID(),
        tenantId: updated.tenantId,
        recipientUserId: director.userId,
        type: "company_number_paused",
        title: "WhatsApp da empresa pausado",
        message: "O número da empresa falhou várias vezes seguidas. Por 30 minutos os avisos da equipe saem pela Meta. Verifique a conexão em Integrações → WhatsApp.",
        idempotencyKey: `company-number-paused:${wahaNumberId}:${pausedUntil.toISOString().slice(0, 16)}`,
        createdAt: now,
      }).onConflictDoNothing();
    }
  }
  return { paused: true };
}

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { getFeatureFlag, FEATURE_FLAGS } from "@/features/system-settings/queries";
import { getWahaChats, sendWahaRelayGroupMessage } from "@/features/waha-cadence/relay-client";
import { getDatabase, schema } from "@/shared/db";

import {
  buildPlantaoReportText,
  calculatePlantaoMetrics,
  classifyPlantaoLead,
  findPlantaoReportGroupId,
  parsePlantaoReportConfig,
  plantaoReportDayKey,
  plantaoReportDayStart,
  plantaoReportLocalHour,
  type PlantaoOfferRow,
  type PlantaoQueueRow,
} from "./plantao-report-core";
import { deliverPlantaoReport } from "./plantao-report-delivery";
import { isSaoPauloWeekend } from "./daily-leads-report-core";

export const PLANTAO_REPORT_SETTING_PREFIX = "plantao_report_";
const PLANTAO_REPORT_STATUS_PREFIX = "heartbeat:plantao-report-status:";
const PLANTAO_REPORT_LOCK_PREFIX = "lease:plantao-report:";

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows?: T[] } | null)?.rows ?? []) as T[];
}

export type PlantaoReportStatus = {
  state: "sent" | "failed" | "disabled" | "before_schedule" | "sending";
  day: string;
  attemptedAt: string;
  sentAt?: string;
  messageId?: string;
  error?: string;
};

function configKey(tenantId: string) {
  return `${PLANTAO_REPORT_SETTING_PREFIX}${tenantId}`;
}

function statusKey(tenantId: string) {
  return `${PLANTAO_REPORT_STATUS_PREFIX}${tenantId}`;
}

function dailyKey(tenantId: string, dayKey: string) {
  return `${PLANTAO_REPORT_LOCK_PREFIX}${tenantId}:${dayKey}`;
}

async function readConfig(tenantId: string) {
  const [row] = await getDatabase().select({ value: schema.systemSettings.value })
    .from(schema.systemSettings).where(eq(schema.systemSettings.key, configKey(tenantId))).limit(1);
  return parsePlantaoReportConfig(row?.value);
}

export async function loadPlantaoReportPageData(tenantId: string, now = new Date()) {
  const [config, status, globallyEnabled] = await Promise.all([
    readConfig(tenantId),
    getPlantaoReportStatus(tenantId),
    getFeatureFlag(FEATURE_FLAGS.PLANTAO_REPORT).then((value) => value === "true"),
  ]);
  let preview: Awaited<ReturnType<typeof loadPlantaoReport>> | null = null;
  let previewError: string | null = null;
  try {
    preview = await loadPlantaoReport(tenantId, now, config);
  } catch {
    previewError = "Não foi possível atualizar a prévia agora. Tente novamente em instantes.";
  }
  const [reservation] = await getDatabase().select({ value: schema.systemSettings.value })
    .from(schema.systemSettings).where(eq(schema.systemSettings.key, dailyKey(tenantId, plantaoReportDayKey(now)))).limit(1);
  const [reservationExpiresAt = "", , reservationState = ""] = reservation?.value.split("|") ?? [];
  const lockedForToday = Boolean(reservationExpiresAt && Number.isFinite(Date.parse(reservationExpiresAt)) && Date.parse(reservationExpiresAt) > now.getTime());
  return { config, status, globallyEnabled, preview, previewError, lockedForToday, reservationState, day: plantaoReportDayKey(now) };
}

async function writeConfig(tenantId: string, config: ReturnType<typeof parsePlantaoReportConfig>) {
  await getDatabase().insert(schema.systemSettings).values({ key: configKey(tenantId), value: JSON.stringify(config), updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.systemSettings.key, set: { value: JSON.stringify(config), updatedAt: new Date() } });
}

export async function loadPlantaoReport(tenantId: string, now = new Date(), configOverride?: ReturnType<typeof parsePlantaoReportConfig>) {
  const config = configOverride ?? await readConfig(tenantId);
  const from = plantaoReportDayStart(now).toISOString();
  const until = now.toISOString();
  const queueResult = await getDatabase().execute(sql`
    with entrants as (
      select l.id,
        coalesce(l.source_metadata, '{}'::jsonb) ? 'formAnswers' as has_form_answers,
        coalesce(l.source_metadata, '{}'::jsonb) ? 'ctwaClid' as has_ctwa_clid,
        coalesce(l.source_metadata, '{}'::jsonb) ? 'withoutReferral' as has_without_referral,
        first_queue.to_queue_id
      from leads l
      left join lateral (
        select event.to_queue_id
        from lead_distribution_events event
        where event.tenant_id = l.tenant_id and event.lead_id = l.id and event.action = 'queued'
        order by event.created_at asc, event.id asc
        limit 1
      ) first_queue on true
      where l.tenant_id = ${tenantId}
        and l.created_at >= ${from}::timestamptz
        and l.created_at < ${until}::timestamptz
    )
    select queue.name as queue_name, entrants.has_form_answers,
      entrants.has_ctwa_clid, entrants.has_without_referral, count(*)::int as count
    from entrants
    left join lead_queues queue on queue.id = entrants.to_queue_id and queue.tenant_id = ${tenantId}
    group by queue.name, entrants.has_form_answers, entrants.has_ctwa_clid, entrants.has_without_referral
  `);
  const offerResult = await getDatabase().execute(sql`
    select offer.lead_id, offer.broker_id, offer.duty_schedule_id,
      schedule.name as duty_name, original_queue.name as original_queue_name, offer.offered_at
    from lead_offers offer
    left join unit_duty_schedules schedule
      on schedule.id = offer.duty_schedule_id and schedule.tenant_id = offer.tenant_id
    left join lateral (
      select event.to_queue_id
      from lead_distribution_events event
      where event.tenant_id = offer.tenant_id and event.lead_id = offer.lead_id and event.action = 'queued'
      order by event.created_at asc, event.id asc
      limit 1
    ) first_queue on true
    left join lead_queues original_queue
      on original_queue.id = first_queue.to_queue_id and original_queue.tenant_id = offer.tenant_id
    where offer.tenant_id = ${tenantId}
      and offer.accepted_at is not null
      and offer.offered_at >= ${from}::timestamptz
      and offer.offered_at < ${until}::timestamptz
  `);
  const queueRows = rowsOf<{ queue_name: string | null; has_form_answers: boolean; has_ctwa_clid: boolean; has_without_referral: boolean; count: number }>(queueResult)
    .map((row): PlantaoQueueRow => ({ queueName: row.queue_name, kind: classifyPlantaoLead({ hasFormAnswers: row.has_form_answers, hasCtwaClid: row.has_ctwa_clid, hasWithoutReferral: row.has_without_referral }), count: Number(row.count) }));
  const offers = rowsOf<{ lead_id: string; broker_id: string; duty_schedule_id: string | null; duty_name: string | null; original_queue_name: string | null; offered_at: Date | string }>(offerResult)
    .map((row): PlantaoOfferRow => ({ leadId: row.lead_id, brokerId: row.broker_id, dutyScheduleId: row.duty_schedule_id, dutyName: row.duty_name, originalQueueName: row.original_queue_name, offeredAt: row.offered_at }));
  const metrics = calculatePlantaoMetrics(queueRows, offers, config);
  return { config, metrics, text: buildPlantaoReportText(metrics, now), day: plantaoReportDayKey(now) };
}

async function writeStatus(tenantId: string, status: PlantaoReportStatus) {
  await getDatabase().insert(schema.systemSettings).values({ key: statusKey(tenantId), value: JSON.stringify(status), updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.systemSettings.key, set: { value: JSON.stringify(status), updatedAt: new Date() } });
}

export async function getPlantaoReportStatus(tenantId: string): Promise<PlantaoReportStatus | null> {
  const [row] = await getDatabase().select({ value: schema.systemSettings.value })
    .from(schema.systemSettings).where(eq(schema.systemSettings.key, statusKey(tenantId))).limit(1);
  if (!row) return null;
  try {
    const value = JSON.parse(row.value) as PlantaoReportStatus;
    return value && typeof value.state === "string" && typeof value.day === "string" ? value : null;
  } catch {
    return null;
  }
}

export async function setPlantaoReportEnabled(tenantId: string, userId: string, enabled: boolean) {
  const db = getDatabase();
  const config = await readConfig(tenantId);
  const next = { ...config, enabled };
  await db.transaction(async (tx) => {
    await tx.insert(schema.systemSettings).values({ key: configKey(tenantId), value: JSON.stringify(next), updatedAt: new Date() })
      .onConflictDoUpdate({ target: schema.systemSettings.key, set: { value: JSON.stringify(next), updatedAt: new Date() } });
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(), userId, entidade: "plantao_report", entidadeId: tenantId,
      acao: enabled ? "plantao_report.enabled" : "plantao_report.disabled",
      metadata: { source: "dashboard", tenantId, groupName: next.groupName },
    });
  });
  return next;
}

async function resolveWahaNumber(tenantId: string, config: ReturnType<typeof parsePlantaoReportConfig>) {
  const [number] = await getDatabase().select({
    id: schema.wahaNumbers.id,
    tenantId: schema.wahaNumbers.tenantId,
    relaySessionId: schema.wahaNumbers.relaySessionId,
    status: schema.wahaNumbers.status,
  }).from(schema.wahaNumbers).where(and(
    eq(schema.wahaNumbers.id, config.wahaNumberId),
    or(isNull(schema.wahaNumbers.tenantId), eq(schema.wahaNumbers.tenantId, tenantId)),
    inArray(schema.wahaNumbers.status, ["active", "WORKING", "ready", "CONNECTED"]),
  )).limit(1);
  if (!number?.relaySessionId) throw new Error("O número WAHA configurado não está conectado ou não pertence a esta empresa.");
  return number;
}

async function reserveDailySend(tenantId: string, day: string, now: Date) {
  const key = dailyKey(tenantId, day);
  const token = randomUUID();
  const expiresAt = new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString();
  const value = `${expiresAt}|${token}|sending`;
  const inserted = rowsOf<{ key: string }>(await getDatabase().execute(sql`
    insert into system_settings (key, value, updated_at)
    values (${key}, ${value}, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()
    where system_settings.value < ${now.toISOString()}
    returning key
  `));
  return inserted.length ? { key, token, expiresAt, value } : null;
}

async function markDailySendSent(reservation: { key: string; token: string; expiresAt: string; value: string }, messageId: string) {
  await getDatabase().execute(sql`
    update system_settings
    set value = ${`${reservation.expiresAt}|${reservation.token}|sent|${encodeURIComponent(messageId)}`}, updated_at = now()
    where key = ${reservation.key} and value = ${reservation.value}
  `);
}

async function releaseDailySendReservation(reservation: { key: string; value: string }) {
  await getDatabase().execute(sql`
    delete from system_settings
    where key = ${reservation.key} and value = ${reservation.value}
  `);
}

function localError(error: unknown) {
  if (error instanceof Error && error.message.startsWith("O número WAHA configurado")) return error.message;
  if (error instanceof Error && error.message.startsWith("WAHA_CHATS_FAILED")) return "Não foi possível consultar os grupos conectados ao número WAHA. Confira a conexão e tente novamente.";
  if (error instanceof Error && error.message.startsWith("WAHA_GROUP_REQUIRES_FASTIFY")) return "O envio para grupos exige o relay WAHA da VPS. Configure VPS_API_URL para esta instalação.";
  if (error instanceof Error && error.message.startsWith("WAHA_GROUP_ID_INVALID")) return "O identificador do grupo WAHA está inválido.";
  if (error instanceof Error && error.message.startsWith("O serviço WAHA não confirmou")) return "O serviço WAHA não confirmou o envio. Confira o estado no WhatsApp antes de tentar novamente.";
  return "O relatório não foi enviado. Confira a conexão WAHA e os logs do serviço.";
}

export async function sendPlantaoReportForTenant(tenantId: string, options: { now?: Date; actorUserId?: string; manual?: boolean } = {}) {
  const now = options.now ?? new Date();
  if (await getFeatureFlag(FEATURE_FLAGS.PLANTAO_REPORT) !== "true") return { tenantId, state: "disabled" as const, reason: "feature_disabled" };
  const config = await readConfig(tenantId);
  if (!config.enabled) return { tenantId, state: "disabled" as const, reason: "tenant_disabled" };
  if (!options.manual && plantaoReportLocalHour(now) < config.hour) {
    return { tenantId, state: "before_schedule" as const, reason: "before_schedule" };
  }
  const { text, day } = await loadPlantaoReport(tenantId, now, config);

  try {
    const number = await resolveWahaNumber(tenantId, config);
    const chats = await getWahaChats({ sessionName: number.relaySessionId, limit: 500, kind: "group" });
    const groupId = findPlantaoReportGroupId(chats, config.groupName);
    if (!groupId) throw new Error(`Grupo "${config.groupName}" não encontrado entre os grupos deste número WAHA.`);
    if (config.groupId !== groupId) {
      const latestConfig = await readConfig(tenantId);
      await writeConfig(tenantId, { ...latestConfig, groupId });
    }

    const delivery = await deliverPlantaoReport({ tenantId, day, now, manual: options.manual === true }, {
      reserveDaily: () => reserveDailySend(tenantId, day, now),
      markDailySent: markDailySendSent,
      releaseDaily: releaseDailySendReservation,
      send: (idempotencyKey) => sendWahaRelayGroupMessage({ idempotencyKey, sessionId: number.relaySessionId, groupId, body: text }),
      onSending: () => writeStatus(tenantId, { state: "sending", day, attemptedAt: now.toISOString() }),
      onSent: async (sent) => {
        const status: PlantaoReportStatus = { state: "sent", day, attemptedAt: now.toISOString(), sentAt: now.toISOString(), messageId: sent.messageId };
        await writeStatus(tenantId, status).catch((error) => console.error("[plantao-report] status_write_failed", { tenantId, day, error: error instanceof Error ? error.message.slice(0, 140) : "unknown" }));
        if (options.actorUserId) {
          await getDatabase().insert(schema.auditLogs).values({
            id: randomUUID(), userId: options.actorUserId, entidade: "plantao_report", entidadeId: tenantId,
            acao: "plantao_report.sent_manually", metadata: { source: "dashboard", tenantId, day, messageId: sent.messageId },
          }).catch((error) => console.error("[plantao-report] audit_write_failed", { tenantId, day, error: error instanceof Error ? error.message.slice(0, 140) : "unknown" }));
        }
      },
      onSideEffectError: (effect, error) => console.error(`[plantao-report] ${effect}`, { tenantId, day, error: error instanceof Error ? error.message.slice(0, 140) : "unknown" }),
    });
    if (delivery.state === "duplicate") return { tenantId, state: "duplicate" as const, reason: delivery.reason };
    if (delivery.state === "failed") throw delivery.error;
    return { tenantId, state: "sent" as const, messageId: delivery.messageId };
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("Grupo ")
      ? error.message
      : localError(error);
    console.error("[plantao-report] send_failed", { tenantId, day, error: error instanceof Error ? error.message.slice(0, 180) : "unknown" });
    await writeStatus(tenantId, { state: "failed", day, attemptedAt: now.toISOString(), error: message });
    if (options.actorUserId) {
      await getDatabase().insert(schema.auditLogs).values({
        id: randomUUID(), userId: options.actorUserId, entidade: "plantao_report", entidadeId: tenantId,
        acao: "plantao_report.manual_send_failed", metadata: { source: "dashboard", tenantId, day, reason: message },
      }).catch(() => undefined);
    }
    return { tenantId, state: "failed" as const, reason: message };
  }
}

export async function runPlantaoReportJob(now = new Date()) {
  if (await getFeatureFlag(FEATURE_FLAGS.PLANTAO_REPORT) !== "true") return { skipped: true as const, reason: "feature_disabled" };
  // Sábado e domingo não tem relatório (Vinicios, 10/11). O "Enviar agora" da tela continua funcionando.
  if (isSaoPauloWeekend(now)) return { skipped: true as const, reason: "weekend" };
  const tenants = await getDatabase().select({ id: schema.tenants.id }).from(schema.tenants).where(eq(schema.tenants.status, "active"));
  const results = [];
  for (const tenant of tenants) {
    try {
      results.push(await sendPlantaoReportForTenant(tenant.id, { now }));
    } catch (error) {
      console.error("[plantao-report] tenant_failed", { tenantId: tenant.id, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
      results.push({ tenantId: tenant.id, state: "failed" as const, reason: "internal_error" });
    }
  }
  return { skipped: false as const, results };
}

export function plantaoReportSettingKeyForTenant(tenantId: string) {
  return configKey(tenantId);
}


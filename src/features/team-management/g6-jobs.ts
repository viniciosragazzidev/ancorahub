import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getTeamMetrics } from "@/features/team-management/metrics";
import { getWeeklyTeamSummary } from "@/features/team-management/weekly-highlights-data";
import { backfillBrokerMetricDailySnapshots } from "@/features/reports/metrics/team-metric-history-service";
import { publishInAppNotification } from "@/features/notifications/send-push-helper";
import { isNotificationCapabilityEnabled } from "@/features/notifications/queries";
import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";
import { isMissingBrokerMetricDailyTable, isMondayMorningInSaoPaulo, isNightlySnapshotWindowInSaoPaulo, runG6LockedWork, saoPauloDayKey } from "./g6-pure";

type JobResult = { skipped: boolean; sent?: number; inserted?: number; historyAvailable?: boolean };

async function withG6Lock<T>(key: string, work: () => Promise<T>): Promise<{ skipped: true } | { skipped: false; value: T }> {
  return getDatabase().transaction(async (tx) => runG6LockedWork(async () => {
    const [lock] = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtext('team-management-g6'), hashtext(${key})) as acquired`);
    return lock?.acquired === true;
  }, work));
}

function contextForRecipient(
  row: { userId: string; tenantId: string; role: "manager" | "supervisor"; branchId: string | null },
  supervisorTeamScopeEnabled: boolean,
): TenantContext {
  return {
    userId: row.userId,
    tenantId: row.tenantId,
    role: row.role,
    jobTitle: row.role,
    branchId: row.branchId,
    supervisorTeamScope: row.role === "supervisor" && supervisorTeamScopeEnabled,
  };
}

function percent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;
}

async function sendWeeklySummaries(now: Date): Promise<JobResult> {
  if (await getFeatureFlag(FEATURE_FLAGS.TEAM_MANAGEMENT).catch(() => "false") !== "true") return { skipped: true, sent: 0 };
  if (!(await isNotificationCapabilityEnabled("team_weekly_summary").catch(() => false))) return { skipped: true, sent: 0 };
  const supervisorTeamScopeEnabled = await getFeatureFlag(FEATURE_FLAGS.SUPERVISOR_TEAM_SCOPE).catch(() => "false") === "true";
  const recipients = await getDatabase().select({
    userId: schema.tenantMemberships.userId,
    tenantId: schema.tenantMemberships.tenantId,
    role: schema.tenantMemberships.role,
    branchId: schema.tenantMemberships.branchId,
  }).from(schema.tenantMemberships).where(and(
    inArray(schema.tenantMemberships.role, ["manager", "supervisor"]),
    eq(schema.tenantMemberships.status, "active"),
  ));

  const result = await withG6Lock("weekly-summary", async () => {
    let sent = 0;
    for (const row of recipients) {
      const context = contextForRecipient(row as typeof recipients[number] & { role: "manager" | "supervisor" }, supervisorTeamScopeEnabled);
      const weekKey = saoPauloDayKey(now);
      const idempotencyKey = `team-weekly-summary:${context.userId}:${weekKey}`;
      const [existing] = await getDatabase().select({ id: schema.notifications.id }).from(schema.notifications).where(and(
        eq(schema.notifications.tenantId, context.tenantId),
        eq(schema.notifications.idempotencyKey, idempotencyKey),
      )).limit(1);
      if (existing) continue;
      const audience = await getLiteAudience(context).catch(() => null);
      if ((context.role === "manager" && audience !== "manager") || (context.role === "supervisor" && audience !== "supervisor")) continue;
      const metrics = await getTeamMetrics(context, { window: 7, now, includeUnitConversionRate: false }).catch(() => null);
      if (!metrics) continue;
      const team = context.role === "supervisor" ? metrics.teams.find((item) => item.supervisorId === context.userId) : null;
      const window = context.role === "manager" ? metrics.unit?.current : team?.current;
      const scopedBrokers = context.role === "manager" ? metrics.brokers : team?.brokers ?? [];
      if (!window) continue;
      const weekly = await getWeeklyTeamSummary({ context, window, brokers: scopedBrokers, now });
      const message = `Últimos 7 dias: ${weekly.summary.leadsReceived} leads, SLA ${percent(weekly.summary.slaRate)}, aceite ${percent(weekly.summary.acceptanceRate)} e conversão ${percent(weekly.summary.conversionRate)}. Abra Gestão para ver os destaques.`;
      const created = await publishInAppNotification({
        capability: "team_weekly_summary",
        tenantId: context.tenantId,
        recipientUserId: context.userId,
        type: "team_weekly_summary",
        title: "Resumo semanal da equipe",
        message,
        idempotencyKey,
      });
      if (created) sent += 1;
    }
    return { sent };
  });
  return result.skipped ? { skipped: true, sent: 0 } : { skipped: false, sent: result.value.sent };
}

async function writeNightlySnapshots(now: Date): Promise<JobResult> {
  if (await getFeatureFlag(FEATURE_FLAGS.TEAM_MANAGEMENT).catch(() => "false") !== "true") return { skipped: true, inserted: 0, historyAvailable: false };
  const result = await withG6Lock("daily-snapshots", async () => {
    try {
      const written = await backfillBrokerMetricDailySnapshots(now);
      return { inserted: written.inserted, historyAvailable: true };
    } catch (error) {
      if (isMissingBrokerMetricDailyTable(error)) return { inserted: 0, historyAvailable: false };
      throw error;
    }
  });
  return result.skipped ? { skipped: true, inserted: 0 } : { skipped: false, ...result.value };
}

/** Runs on the existing two-minute engagement cron. Each action is protected by its own xact lock. */
export async function runTeamManagementG6Jobs(now = new Date()): Promise<{ weekly: JobResult; snapshots: JobResult }> {
  const weekly = isMondayMorningInSaoPaulo(now) ? await sendWeeklySummaries(now) : { skipped: true, sent: 0 };
  const snapshots = isNightlySnapshotWindowInSaoPaulo(now) ? await writeNightlySnapshots(now) : { skipped: true, inserted: 0 };
  return { weekly, snapshots };
}

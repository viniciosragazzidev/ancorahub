import "server-only";

import { and, count, desc, eq, gte, inArray, isNull, lte, min } from "drizzle-orm";

import { visibleToManagement } from "@/features/supervisor-workspace/lead-import/team-list-sql";
import { getDatabase, schema } from "@/shared/db";

import type { QualificationAlertRecord } from "./alerts-service";
import { AI_FAILURE_WINDOW_HOURS, WAITING_LEAD_ALERT_MINUTES, buildLiveAlerts } from "./live-alerts-rules";

/** Mesmos estados de "esperando corretor" do painel (src/features/dashboard/today.ts). */
const WAITING_STATES = ["queued", "unassigned", "returned_to_queue"] as const;

/** Fatos de agora que viram alerta: leads sem corretor há muito tempo e falhas seguidas da IA. */
export async function getLiveQualificationAlerts(tenantId: string, now = new Date()): Promise<QualificationAlertRecord[]> {
  const db = getDatabase();
  const waitingCutoff = new Date(now.getTime() - WAITING_LEAD_ALERT_MINUTES * 60_000);
  const failureSince = new Date(now.getTime() - AI_FAILURE_WINDOW_HOURS * 3_600_000);
  const failedInWindow = and(
    eq(schema.aiAttendanceLogs.tenantId, tenantId),
    eq(schema.aiAttendanceLogs.status, "failed"),
    gte(schema.aiAttendanceLogs.createdAt, failureSince),
  );

  const [[waiting], [failures], [lastFailure]] = await Promise.all([
    db.select({ value: count(), oldest: min(schema.leads.createdAt) }).from(schema.leads).where(and(
      eq(schema.leads.tenantId, tenantId),
      isNull(schema.leads.deletedAt),
      isNull(schema.leads.archivedAt),
      isNull(schema.leads.corretorId),
      inArray(schema.leads.distributionStatus, [...WAITING_STATES]),
      lte(schema.leads.createdAt, waitingCutoff),
      visibleToManagement(),
    )),
    db.select({ value: count() }).from(schema.aiAttendanceLogs).where(failedInWindow),
    db.select({ error: schema.aiAttendanceLogs.errorMessage, at: schema.aiAttendanceLogs.createdAt })
      .from(schema.aiAttendanceLogs)
      .where(failedInWindow)
      .orderBy(desc(schema.aiAttendanceLogs.createdAt))
      .limit(1),
  ]);

  return buildLiveAlerts(tenantId, {
    waitingLeads: Number(waiting?.value ?? 0),
    oldestWaitingSince: waiting?.oldest ?? null,
    aiFailures: Number(failures?.value ?? 0),
    lastAiError: lastFailure?.error ?? null,
    lastAiFailureAt: lastFailure?.at ?? null,
  });
}

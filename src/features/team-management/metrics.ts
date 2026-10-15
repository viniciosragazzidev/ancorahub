import "server-only";

import { randomUUID } from "node:crypto";

import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { getMetricDefinition } from "@/features/reports/metrics/metric-catalog";
import { resolveCanonicalTeamMetrics, type CanonicalTeamMetricRow } from "@/features/reports/metrics/team-metrics-service";
import { TtlCache } from "@/shared/cache/ttl-cache";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { isTeamMetricRowVisibleInScope, resolveTeamMetricsScope, type TeamMetricsScope } from "./scope";

export type TeamMetricWindow = {
  received: number;
  accepted: number;
  acceptanceRate: number;
  medianAcceptanceSeconds: number | null;
  redistributions: number;
  slaRate: number;
  activeLeads: number | null;
  overdueReturns: number | null;
  criticalOverdueReturns: number | null;
  leadsWithoutNextAction: number | null;
  quotes: number;
  sales: number;
  losses: number;
  conversion: { received: number; converted: number; rate: number };
  lastActivityAt: Date | null;
};

export type TeamMetricBroker = {
  id: string;
  name: string;
  image: string | null;
  supervisorId: string | null;
  supervisorName: string | null;
  teamName: string;
  branchId: string | null;
  current: TeamMetricWindow;
  previous: TeamMetricWindow;
  recent3DaysRedistributions: number;
  previous3DaysRedistributions: number;
};

export type TeamMetricTeam = {
  id: string;
  name: string;
  supervisorId: string | null;
  supervisorName: string | null;
  branchId: string | null;
  current: TeamMetricWindow;
  previous: TeamMetricWindow;
  recent3DaysRedistributions: number;
  previous3DaysRedistributions: number;
  brokers: TeamMetricBroker[];
};

export type TeamMetricsResult = {
  window: 7 | 30;
  generatedAt: Date;
  slaFirstContactMinutes: number;
  unit: { id: string; name: string | null; current: TeamMetricWindow; previous: TeamMetricWindow } | null;
  /** Conversão agregada da unidade: referência da saúde para gestor e supervisor (nenhuma linha de outra equipe). */
  unitConversionRate: number | null;
  teams: TeamMetricTeam[];
  brokers: TeamMetricBroker[];
};

const metricsCache = new TtlCache<TeamMetricsResult>(60_000, 400);

function value(row: CanonicalTeamMetricRow, id: string): number | null {
  const definition = getMetricDefinition(id);
  if (!definition) throw new Error(`Métrica canônica ausente do catálogo: ${id}.`);
  const dimension = row.scopeType === "unit" ? "unit" : row.scopeType === "team" ? "team" : "broker";
  if (!definition.allowedDimensions.includes(dimension)) {
    throw new Error(`A métrica ${id} não permite a dimensão ${dimension}.`);
  }
  return row.metrics[id as keyof typeof row.metrics] ?? null;
}

function windowValue(row: CanonicalTeamMetricRow): TeamMetricWindow {
  const received = value(row, "team.offers_received") ?? 0;
  const accepted = value(row, "team.offers_accepted") ?? 0;
  const leadCohort = value(row, "commercial.leads_received") ?? 0;
  const converted = value(row, "commercial.leads_converted") ?? 0;
  const lastActivity = value(row, "team.last_activity_at");
  return {
    received,
    accepted,
    acceptanceRate: value(row, "team.acceptance_rate") ?? 0,
    medianAcceptanceSeconds: value(row, "team.median_acceptance_time"),
    redistributions: value(row, "team.redistributions") ?? 0,
    slaRate: value(row, "team.first_contact_sla_rate") ?? 0,
    activeLeads: value(row, "team.active_leads"),
    overdueReturns: value(row, "team.overdue_returns"),
    criticalOverdueReturns: value(row, "team.critical_overdue_returns"),
    leadsWithoutNextAction: value(row, "team.leads_without_next_action"),
    quotes: value(row, "team.quotes") ?? 0,
    sales: value(row, "team.sales") ?? 0,
    losses: value(row, "team.losses") ?? 0,
    conversion: {
      received: leadCohort,
      converted,
      rate: value(row, "commercial.conversion_rate") ?? 0,
    },
    lastActivityAt: lastActivity == null ? null : new Date(lastActivity),
  };
}

function buildResult(snapshot: Awaited<ReturnType<typeof resolveCanonicalTeamMetrics>>): TeamMetricsResult {
  const rows = snapshot.rows;
  const brokerRows = rows.filter((row) => row.scopeType === "broker");
  const teamRows = rows.filter((row) => row.scopeType === "team");
  const unitRows = rows.filter((row) => row.scopeType === "unit");
  const rowByScope = new Map(rows.map((row) => [`${row.scopeType}:${row.scopeId}:${row.windowKey}`, row]));
  const allBrokers = new Map<string, TeamMetricBroker>();
  const brokerFor = (id: string) => {
    const currentRow = rowByScope.get(`broker:${id}:current`);
    const previousRow = rowByScope.get(`broker:${id}:previous`);
    if (!currentRow || !previousRow) return null;
    const subject: TeamMetricBroker = {
      id,
      name: currentRow.brokerName ?? "Corretor",
      image: currentRow.brokerImage,
      supervisorId: currentRow.supervisorId,
      supervisorName: currentRow.supervisorName,
      teamName: currentRow.teamName ?? "Sem equipe",
      branchId: currentRow.branchId,
      current: windowValue(currentRow),
      previous: windowValue(previousRow),
      recent3DaysRedistributions: value(rowByScope.get(`broker:${id}:trailing3`) ?? currentRow, "team.redistributions") ?? 0,
      previous3DaysRedistributions: value(rowByScope.get(`broker:${id}:previous3`) ?? previousRow, "team.redistributions") ?? 0,
    };
    allBrokers.set(id, subject);
    return subject;
  };
  for (const row of brokerRows) if (row.windowKey === "current") brokerFor(row.scopeId);

  const teams: TeamMetricTeam[] = [];
  for (const row of teamRows) {
    if (row.windowKey !== "current") continue;
    const id = row.scopeId;
    const current = rowByScope.get(`team:${id}:current`);
    const previous = rowByScope.get(`team:${id}:previous`);
    if (!current || !previous) continue;
    teams.push({
      id,
      name: current.teamName ?? "Sem equipe",
      supervisorId: current.supervisorId,
      supervisorName: current.supervisorName,
      branchId: current.branchId,
      current: windowValue(current),
      previous: windowValue(previous),
      recent3DaysRedistributions: value(rowByScope.get(`team:${id}:trailing3`) ?? current, "team.redistributions") ?? 0,
      previous3DaysRedistributions: value(rowByScope.get(`team:${id}:previous3`) ?? previous, "team.redistributions") ?? 0,
      brokers: [...allBrokers.values()].filter((broker) =>
        id === "__no_team__" ? broker.supervisorId === null : broker.supervisorId === id,
      ),
    });
  }

  let unit: TeamMetricsResult["unit"] = null;
  const unitCurrent = unitRows.find((row) => row.windowKey === "current");
  const unitPrevious = unitRows.find((row) => row.windowKey === "previous");
  if (unitCurrent && unitPrevious) {
    unit = {
      id: unitCurrent.branchId ?? unitCurrent.scopeId,
      name: unitCurrent.branchName,
      current: windowValue(unitCurrent),
      previous: windowValue(unitPrevious),
    };
  }

  return {
    window: snapshot.windowDays,
    generatedAt: snapshot.now,
    slaFirstContactMinutes: snapshot.slaFirstContactMinutes,
    unit,
    unitConversionRate: unit ? unit.current.conversion.rate : null,
    teams,
    brokers: [...allBrokers.values()],
  };
}

/** Referência de conversão da unidade para o supervisor: só a média agregada da unidade. */
async function unitConversionReference(context: TenantContext, scope: TeamMetricsScope, input: { window: 7 | 30; now: Date }): Promise<number | null> {
  if (!context.branchId) return null;
  const snapshot = await resolveCanonicalTeamMetrics(context, { kind: "unit", tenantId: scope.tenantId, branchId: context.branchId }, input);
  const row = snapshot.rows.find((item) => item.scopeType === "unit" && item.windowKey === "current");
  return row ? value(row, "commercial.conversion_rate") : null;
}

/** Scoped, audited, 60-second cached team metrics. */
export async function getTeamMetrics(
  context: TenantContext,
  input: { window: 7 | 30; now: Date },
): Promise<TeamMetricsResult> {
  const scope = resolveTeamMetricsScope(context);
  const enabled = await getFeatureFlag(FEATURE_FLAGS.TEAM_MANAGEMENT);
  if (enabled !== "true") throw new Error("A gestão de equipes está desativada pelo Super Admin.");

  const minuteBucket = Math.floor(input.now.getTime() / 60_000);
  const scopeKey = scope.kind === "unit" ? `unit:${scope.branchId}` : `team:${scope.supervisorId}`;
  const cacheKey = `${scope.tenantId}:${scope.kind}:${scopeKey}:${input.window}:${minuteBucket}`;
  const result = await metricsCache.getOrLoad(cacheKey, async () => {
    const snapshot = await resolveCanonicalTeamMetrics(context, scope, input);
    if (snapshot.rows.some((row) => !isTeamMetricRowVisibleInScope(scope, { ...row, tenantId: snapshot.tenantId }))) {
      throw new Error("A consulta agregada retornou uma métrica fora do escopo autorizado.");
    }
    const built = buildResult(snapshot);
    if (scope.kind === "team") built.unitConversionRate = await unitConversionReference(context, scope, input);
    return built;
  });

  await getDatabase().insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "team_management_metrics",
    entidadeId: scope.kind === "unit" ? scope.branchId : scope.supervisorId,
    acao: `team_management_metrics.viewed:${input.window}d`,
    createdAt: input.now,
  });
  return result;
}

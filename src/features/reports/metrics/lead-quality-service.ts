import "server-only";

import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gte, isNull, lt, sql, type SQL, type SQLWrapper } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { leadQualityWindow, type LeadQualityPeriod, type LeadQualityWindow } from "./lead-quality-period";
import { listEffectiveCapabilities } from "@/features/custom-roles/service";

import { resolveReportDataScope } from "./metric-scope";
import { LEAD_ORIGINS, LEAD_QUALITY_DIMENSIONS, type LeadOrigin, type LeadQualityDimension, type LeadQualityFilters, type LeadQualityFocus } from "./lead-quality-contract";
import { leadQualityRates, percentage } from "./metrics-math";

export { LEAD_QUALITY_DIMENSIONS } from "./lead-quality-contract";
export { parseLeadQualityFocus } from "./lead-quality-contract";
export { LEAD_ORIGINS, parseLeadOrigin } from "./lead-quality-contract";
export type { LeadOrigin, LeadQualityDimension, LeadQualityFilters, LeadQualityFocus } from "./lead-quality-contract";

export type LeadQualitySegment = {
  dimension: LeadQualityDimension;
  key: string;
  label: string;
  total: number;
  hot: number;
  warm: number;
  cold: number;
  unclassified: number;
  converted: number;
  hotWarmConverted: number;
  assigned: number;
  metaAttributed: number;
  averageFirstContactSeconds: number | null;
  hotWarmShare: number;
  conversionRate: number;
};

export type LeadQualityLead = {
  id: string;
  name: string;
  status: string;
  qualificationStatus: string;
  createdAt: string;
  queueName: string | null;
  brokerName: string | null;
};

export type LeadQualityReport = {
  enabled: boolean;
  period: LeadQualityPeriod;
  /** Leads created in [since, until); until null = open. */
  window: { since: string; until: string | null };
  filters: LeadQualityFilters;
  generatedAt: string;
  summary: {
    total: number;
    hot: number;
    warm: number;
    cold: number;
    unclassified: number;
    classified: number;
    converted: number;
    hotWarmConverted: number;
    assigned: number;
    metaAttributed: number;
    averageFirstContactSeconds: number | null;
    classificationCoverage: number;
    hotWarmShare: number;
    hotWarmConversionRate: number;
    conversionRate: number;
    assignedRate: number;
    metaAdAttributionCoverage: number;
    temperatureDistribution: { hot: number; warm: number; cold: number; unclassified: number };
  };
  segments: Record<LeadQualityDimension, LeadQualitySegment[]>;
  focus: LeadQualityFocus | null;
  focusedLeads: LeadQualityLead[];
  focusedLeadCount: number;
};

export const LEAD_QUALITY_MINIMUM_GROUP_SIZE = 3;
const MAX_SEGMENTS_PER_DIMENSION = 12;
const MAX_FOCUSED_LEADS = 50;
const UNKNOWN_KEY = "__unknown__";
const unknownText = (column: SQLWrapper) => sql`(${column} IS NULL OR ${column} = '')`;

export async function canAccessLeadQualityCenter(context: TenantContext) {
  const capabilities = await listEffectiveCapabilities({
    tenantId: context.tenantId,
    role: context.role,
    jobTitle: context.jobTitle,
    customRoleId: context.customRoleId ?? null,
  });
  return capabilities.includes("acessar_relatorios") || capabilities.includes("acessar_campanhas_meta");
}

const emptySegments = (): Record<LeadQualityDimension, LeadQualitySegment[]> => ({
  source: [], campaign: [], adset: [], ad: [], form: [], queue: [], broker: [],
  lead_type: [], plan_type: [], city: [], age_band: [], hour: [],
  origin: [], shift: [], origin_shift: [],
});

/** Dimensions always shown in full (small, fixed groups), even under the minimum group size. */
const COMPLETE_DIMENSIONS: ReadonlySet<LeadQualityDimension> = new Set(["origin", "shift", "origin_shift"]);

/** Formulário / WhatsApp / Outros — the same rule as the "WhatsApp" pill in /leads. */
export function leadOriginExpression() {
  return sql<LeadOrigin>`CASE
    WHEN ${schema.leads.sourceChannel} = 'meta_lead_ads' AND ${schema.leads.sourceMetadata}->>'entry' = 'whatsapp' THEN 'whatsapp'
    WHEN ${schema.leads.sourceChannel} = 'meta_lead_ads' THEN 'form'
    ELSE 'other'
  END`;
}

/** Turno 2 = 13:30–18:00 (São Paulo); everything else (18:00–13:30) is Turno 1. */
export function leadShiftExpression() {
  return sql<number>`CASE
    WHEN timezone('America/Sao_Paulo', ${schema.leads.createdAt})::time >= time '13:30'
     AND timezone('America/Sao_Paulo', ${schema.leads.createdAt})::time < time '18:00' THEN 2
    ELSE 1
  END`;
}

/** Window + queue + origin conditions shared by every query of the report. */
export function leadQualityCohortWhere(window: LeadQualityWindow, filters: LeadQualityFilters): SQL | undefined {
  return and(
    gte(schema.leads.createdAt, window.since),
    window.until ? lt(schema.leads.createdAt, window.until) : undefined,
    filters.queueId ? eq(schema.leads.queueId, filters.queueId) : undefined,
    filters.origin ? sql`${leadOriginExpression()} = ${filters.origin}` : undefined,
  );
}

const originLabels = Object.fromEntries(LEAD_ORIGINS.map((origin) => [origin.key, origin.label])) as Record<LeadOrigin, string>;

function ageBandExpression() {
  const details = schema.leads.qualificationDetails;
  const candidate = sql<number | null>`CASE
    WHEN (${details}->>'averageAge') ~ '^[0-9]{1,3}$' THEN (${details}->>'averageAge')::int
    WHEN (${details}->>'individualAges') ~ '^[0-9]{1,3}$' THEN (${details}->>'individualAges')::int
    ELSE NULL
  END`;
  return sql<string>`CASE
    WHEN (${candidate}) BETWEEN 0 AND 17 THEN '0–17'
    WHEN (${candidate}) BETWEEN 18 AND 24 THEN '18–24'
    WHEN (${candidate}) BETWEEN 25 AND 34 THEN '25–34'
    WHEN (${candidate}) BETWEEN 35 AND 44 THEN '35–44'
    WHEN (${candidate}) BETWEEN 45 AND 54 THEN '45–54'
    WHEN (${candidate}) BETWEEN 55 AND 64 THEN '55–64'
    WHEN (${candidate}) BETWEEN 65 AND 120 THEN '65+'
    ELSE 'Não informada'
  END`;
}

function focusWhere(focus: LeadQualityFocus | null): SQL | undefined {
  if (!focus) return undefined;
  const unknown = focus.key === UNKNOWN_KEY;
  switch (focus.dimension) {
    case "source":
      return unknown ? unknownText(schema.leads.sourceChannel) : eq(schema.leads.sourceChannel, focus.key);
    case "campaign":
      return unknown ? unknownText(schema.leads.metaCampaignId) : eq(schema.leads.metaCampaignId, focus.key);
    case "adset":
      return unknown ? unknownText(schema.leads.metaAdSetId) : eq(schema.leads.metaAdSetId, focus.key);
    case "ad":
      return unknown ? unknownText(schema.leads.metaAdId) : eq(schema.leads.metaAdId, focus.key);
    case "form":
      return unknown ? unknownText(schema.leads.metaFormId) : eq(schema.leads.metaFormId, focus.key);
    case "queue":
      return unknown ? unknownText(schema.leads.queueId) : eq(schema.leads.queueId, focus.key);
    case "broker":
      return unknown ? unknownText(schema.leads.corretorId) : eq(schema.leads.corretorId, focus.key);
    case "lead_type":
      return eq(schema.leads.tipo, focus.key);
    case "plan_type":
      return unknown
        ? sql`(${schema.leads.qualificationDetails}->>'planType' IS NULL OR ${schema.leads.qualificationDetails}->>'planType' = '')`
        : sql`${schema.leads.qualificationDetails}->>'planType' = ${focus.key}`;
    case "city":
      return unknown
        ? sql`(${schema.leads.qualificationDetails}->>'city' IS NULL OR ${schema.leads.qualificationDetails}->>'city' = '')`
        : sql`${schema.leads.qualificationDetails}->>'city' = ${focus.key}`;
    case "age_band":
      return eq(ageBandExpression(), focus.key);
    case "origin":
      return sql`${leadOriginExpression()} = ${focus.key}`;
    case "shift":
      return sql`${leadShiftExpression()} = ${Number(focus.key)}`;
    case "origin_shift": {
      const [origin, shift] = focus.key.split(":");
      return and(sql`${leadOriginExpression()} = ${origin}`, sql`${leadShiftExpression()} = ${Number(shift)}`);
    }
    case "hour": {
      const [day, hour] = focus.key.split(":").map(Number);
      return and(
        sql`extract(dow from timezone('America/Sao_Paulo', ${schema.leads.createdAt}))::int = ${day}`,
        sql`extract(hour from timezone('America/Sao_Paulo', ${schema.leads.createdAt}))::int = ${hour}`,
      );
    }
  }
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function aggregateFromSegment(segment: Pick<LeadQualitySegment,
  "total" | "hot" | "warm" | "cold" | "unclassified" | "converted" |
  "hotWarmConverted" | "assigned" | "metaAttributed" | "averageFirstContactSeconds"
>) {
  const counts = {
    total: segment.total,
    hot: segment.hot,
    warm: segment.warm,
    cold: segment.cold,
    converted: segment.converted,
    hotWarmConverted: segment.hotWarmConverted,
    assigned: segment.assigned,
    metaAttributed: segment.metaAttributed,
  };
  return {
    ...counts,
    unclassified: segment.unclassified,
    classified: segment.hot + segment.warm + segment.cold,
    averageFirstContactSeconds: segment.averageFirstContactSeconds,
    ...leadQualityRates(counts),
  };
}

/**
 * One tenant-scoped cohort scan produces the summary and all grouped cuts.
 * Lead PII is fetched only for an explicitly selected, authorized segment.
 */
export async function getLeadQualityReport(
  context: TenantContext,
  period: LeadQualityPeriod,
  focus: LeadQualityFocus | null = null,
  filters: LeadQualityFilters = { queueId: null, origin: null },
  options: { audit?: boolean; now?: Date } = {},
): Promise<LeadQualityReport> {
  const window = leadQualityWindow(period, options.now);
  const serializedWindow = { since: window.since.toISOString(), until: window.until?.toISOString() ?? null };
  if (!(await canAccessLeadQualityCenter(context))) throw new Error("Você não tem permissão para acessar esta análise.");

  const enabled = (await getFeatureFlag(FEATURE_FLAGS.REPORTING_CENTER)) !== "false";
  if (!enabled) {
    return {
      enabled: false, period, window: serializedWindow, filters, generatedAt: new Date().toISOString(),
      summary: { total: 0, hot: 0, warm: 0, cold: 0, unclassified: 0, classified: 0, converted: 0, hotWarmConverted: 0, assigned: 0, metaAttributed: 0, averageFirstContactSeconds: null, classificationCoverage: 0, hotWarmShare: 0, hotWarmConversionRate: 0, conversionRate: 0, assignedRate: 0, metaAdAttributionCoverage: 0, temperatureDistribution: { hot: 0, warm: 0, cold: 0, unclassified: 0 } },
      segments: emptySegments(), focus, focusedLeads: [], focusedLeadCount: 0,
    };
  }

  const db = getDatabase();
  const scope = await resolveReportDataScope(context);
  const cohort = db.$with("lead_quality_cohort").as(
    db.select({
      source: schema.leads.sourceChannel,
      campaignId: schema.leads.metaCampaignId,
      campaignName: sql<string | null>`${schema.metaCampaigns.name}`.as("campaignName"),
      adsetId: schema.leads.metaAdSetId,
      adsetName: sql<string | null>`${schema.metaAdSets.name}`.as("adsetName"),
      adId: schema.leads.metaAdId,
      adName: sql<string | null>`${schema.metaAds.name}`.as("adName"),
      formId: schema.leads.metaFormId,
      formName: sql<string | null>`${schema.metaLeadForms.name}`.as("formName"),
      queueId: schema.leads.queueId,
      queueName: sql<string | null>`${schema.leadQueues.name}`.as("queueName"),
      brokerId: schema.leads.corretorId,
      brokerName: sql<string | null>`${schema.user.name}`.as("brokerName"),
      leadType: schema.leads.tipo,
      planType: sql<string | null>`${schema.leads.qualificationDetails}->>'planType'`.as("planType"),
      city: sql<string | null>`${schema.leads.qualificationDetails}->>'city'`.as("city"),
      ageBand: ageBandExpression().as("ageBand"),
      weekday: sql<number>`extract(dow from timezone('America/Sao_Paulo', ${schema.leads.createdAt}))::int`.as("weekday"),
      hour: sql<number>`extract(hour from timezone('America/Sao_Paulo', ${schema.leads.createdAt}))::int`.as("hour"),
      origin: leadOriginExpression().as("origin"),
      shift: leadShiftExpression().as("shift"),
      qualificationStatus: schema.leads.qualificationStatus,
      status: schema.leads.status,
      hasMetaAd: sql<boolean>`${schema.leads.metaAdId} IS NOT NULL`.as("hasMetaAd"),
      firstContactSeconds: schema.leads.firstContactLatencySeconds,
    }).from(schema.leads)
      .leftJoin(schema.metaCampaigns, and(eq(schema.metaCampaigns.tenantId, context.tenantId), eq(schema.metaCampaigns.campaignId, schema.leads.metaCampaignId)))
      .leftJoin(schema.metaAdSets, and(eq(schema.metaAdSets.tenantId, context.tenantId), eq(schema.metaAdSets.adSetId, schema.leads.metaAdSetId)))
      .leftJoin(schema.metaAds, and(eq(schema.metaAds.tenantId, context.tenantId), eq(schema.metaAds.adId, schema.leads.metaAdId)))
      .leftJoin(schema.metaLeadForms, and(eq(schema.metaLeadForms.tenantId, context.tenantId), eq(schema.metaLeadForms.formId, schema.leads.metaFormId)))
      .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.tenantId, context.tenantId), eq(schema.leadQueues.id, schema.leads.queueId)))
      .leftJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, schema.leads.corretorId), eq(schema.tenantMemberships.status, "active")))
      .leftJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(
        eq(schema.leads.tenantId, scope.tenantId),
        isNull(schema.leads.deletedAt),
        isNull(schema.leads.archivedAt),
        leadQualityCohortWhere(window, filters),
        scope.leadScope,
        focusWhere(focus),
      )),
  );

  const source = cohort.source;
  const campaign = cohort.campaignId;
  const adset = cohort.adsetId;
  const ad = cohort.adId;
  const form = cohort.formId;
  const queue = cohort.queueId;
  const broker = cohort.brokerId;
  const leadType = cohort.leadType;
  const plan = cohort.planType;
  const city = cohort.city;
  const age = cohort.ageBand;
  const weekday = cohort.weekday;
  const hour = cohort.hour;
  const origin = cohort.origin;
  const shift = cohort.shift;
  const dimension = sql<string>`CASE
    WHEN GROUPING(${origin}) = 0 AND GROUPING(${shift}) = 0 THEN 'origin_shift'
    WHEN GROUPING(${origin}) = 0 THEN 'origin'
    WHEN GROUPING(${shift}) = 0 THEN 'shift'
    WHEN GROUPING(${source}) = 0 THEN 'source'
    WHEN GROUPING(${campaign}) = 0 THEN 'campaign'
    WHEN GROUPING(${adset}) = 0 THEN 'adset'
    WHEN GROUPING(${ad}) = 0 THEN 'ad'
    WHEN GROUPING(${form}) = 0 THEN 'form'
    WHEN GROUPING(${queue}) = 0 THEN 'queue'
    WHEN GROUPING(${broker}) = 0 THEN 'broker'
    WHEN GROUPING(${leadType}) = 0 THEN 'lead_type'
    WHEN GROUPING(${plan}) = 0 THEN 'plan_type'
    WHEN GROUPING(${city}) = 0 THEN 'city'
    WHEN GROUPING(${age}) = 0 THEN 'age_band'
    WHEN GROUPING(${weekday}) = 0 THEN 'hour'
    ELSE 'summary'
  END`;
  const key = sql<string>`CASE
    WHEN GROUPING(${origin}) = 0 AND GROUPING(${shift}) = 0 THEN MAX(${origin}) || ':' || MAX(${shift})::text
    WHEN GROUPING(${origin}) = 0 THEN MAX(${origin})
    WHEN GROUPING(${shift}) = 0 THEN MAX(${shift})::text
    WHEN GROUPING(${source}) = 0 THEN COALESCE(NULLIF(MAX(${source}), ''), ${UNKNOWN_KEY})
    WHEN GROUPING(${campaign}) = 0 THEN COALESCE(NULLIF(MAX(${campaign}), ''), ${UNKNOWN_KEY})
    WHEN GROUPING(${adset}) = 0 THEN COALESCE(NULLIF(MAX(${adset}), ''), ${UNKNOWN_KEY})
    WHEN GROUPING(${ad}) = 0 THEN COALESCE(NULLIF(MAX(${ad}), ''), ${UNKNOWN_KEY})
    WHEN GROUPING(${form}) = 0 THEN COALESCE(NULLIF(MAX(${form}), ''), ${UNKNOWN_KEY})
    WHEN GROUPING(${queue}) = 0 THEN COALESCE(NULLIF(MAX(${queue}), ''), ${UNKNOWN_KEY})
    WHEN GROUPING(${broker}) = 0 THEN COALESCE(NULLIF(MAX(${broker}), ''), ${UNKNOWN_KEY})
    WHEN GROUPING(${leadType}) = 0 THEN COALESCE(NULLIF(MAX(${leadType}), ''), ${UNKNOWN_KEY})
    WHEN GROUPING(${plan}) = 0 THEN COALESCE(NULLIF(MAX(${plan}), ''), ${UNKNOWN_KEY})
    WHEN GROUPING(${city}) = 0 THEN COALESCE(NULLIF(MAX(${city}), ''), ${UNKNOWN_KEY})
    WHEN GROUPING(${age}) = 0 THEN COALESCE(MAX(${age}), ${UNKNOWN_KEY})
    WHEN GROUPING(${weekday}) = 0 THEN MAX(${weekday})::text || ':' || MAX(${hour})::text
    ELSE 'all'
  END`;
  const label = sql<string>`CASE
    WHEN GROUPING(${origin}) = 0 AND GROUPING(${shift}) = 0 THEN MAX(${origin}) || ':' || MAX(${shift})::text
    WHEN GROUPING(${origin}) = 0 THEN MAX(${origin})
    WHEN GROUPING(${shift}) = 0 THEN 'Turno ' || MAX(${shift})::text
    WHEN GROUPING(${source}) = 0 THEN COALESCE(NULLIF(MAX(${source}), ''), 'Origem não identificada')
    WHEN GROUPING(${campaign}) = 0 THEN COALESCE(NULLIF(MAX(${cohort.campaignName}), ''), 'Campanha não identificada')
    WHEN GROUPING(${adset}) = 0 THEN COALESCE(NULLIF(MAX(${cohort.adsetName}), ''), 'Conjunto não identificado')
    WHEN GROUPING(${ad}) = 0 THEN COALESCE(NULLIF(MAX(${cohort.adName}), ''), 'Anúncio não identificado')
    WHEN GROUPING(${form}) = 0 THEN COALESCE(NULLIF(MAX(${cohort.formName}), ''), 'Formulário não identificado')
    WHEN GROUPING(${queue}) = 0 THEN COALESCE(NULLIF(MAX(${cohort.queueName}), ''), 'Sem fila atribuída')
    WHEN GROUPING(${broker}) = 0 THEN COALESCE(NULLIF(MAX(${cohort.brokerName}), ''), 'Sem corretor atribuído')
    WHEN GROUPING(${leadType}) = 0 THEN COALESCE(NULLIF(MAX(${leadType}), ''), 'Tipo não informado')
    WHEN GROUPING(${plan}) = 0 THEN COALESCE(NULLIF(MAX(${plan}), ''), 'Plano não informado')
    WHEN GROUPING(${city}) = 0 THEN COALESCE(NULLIF(MAX(${city}), ''), 'Cidade não informada')
    WHEN GROUPING(${age}) = 0 THEN COALESCE(NULLIF(MAX(${age}), ''), 'Idade não informada')
    WHEN GROUPING(${weekday}) = 0 THEN MAX(${weekday})::text || ':' || MAX(${hour})::text
    ELSE 'Total da seleção'
  END`;
  const groupingSets = sql`GROUPING SETS (
    (), (${source}), (${campaign}), (${adset}), (${ad}), (${form}), (${queue}),
    (${broker}), (${leadType}), (${plan}), (${city}), (${age}), (${weekday}, ${hour}),
    (${origin}), (${shift}), (${origin}, ${shift})
  )`;

  const groupedRows = await db.with(cohort).select({
    dimension,
    key,
    label,
    total: count(),
    hot: sql<number>`count(*) FILTER (WHERE ${cohort.qualificationStatus} = 'hot')::int`,
    warm: sql<number>`count(*) FILTER (WHERE ${cohort.qualificationStatus} = 'warm')::int`,
    cold: sql<number>`count(*) FILTER (WHERE ${cohort.qualificationStatus} = 'cold')::int`,
    unclassified: sql<number>`count(*) FILTER (WHERE ${cohort.qualificationStatus} NOT IN ('hot', 'warm', 'cold'))::int`,
    converted: sql<number>`count(*) FILTER (WHERE ${cohort.status} = 'converted')::int`,
    hotWarmConverted: sql<number>`count(*) FILTER (WHERE ${cohort.status} = 'converted' AND ${cohort.qualificationStatus} IN ('hot', 'warm'))::int`,
    assigned: sql<number>`count(*) FILTER (WHERE ${cohort.brokerId} IS NOT NULL)::int`,
    metaAttributed: sql<number>`count(*) FILTER (WHERE ${cohort.hasMetaAd})::int`,
    averageFirstContactSeconds: sql<number | null>`avg(${cohort.firstContactSeconds}) FILTER (WHERE ${cohort.firstContactSeconds} IS NOT NULL)`,
  }).from(cohort).groupBy(groupingSets).orderBy(desc(count()));

  const segments = emptySegments();
  let summary: LeadQualityReport["summary"] | null = null;
  for (const row of groupedRows) {
    const total = numberValue(row.total);
    if (row.dimension === "summary") {
      const segment = {
        dimension: "source", key: "all", label: "Total da seleção", total,
        hot: numberValue(row.hot), warm: numberValue(row.warm), cold: numberValue(row.cold),
        unclassified: numberValue(row.unclassified), converted: numberValue(row.converted),
        hotWarmConverted: numberValue(row.hotWarmConverted), assigned: numberValue(row.assigned),
        metaAttributed: numberValue(row.metaAttributed),
        averageFirstContactSeconds: row.averageFirstContactSeconds == null ? null : numberValue(row.averageFirstContactSeconds),
      };
      const aggregate = aggregateFromSegment(segment);
      summary = {
        ...aggregate,
        temperatureDistribution: {
          hot: percentage(segment.hot, segment.total),
          warm: percentage(segment.warm, segment.total),
          cold: percentage(segment.cold, segment.total),
          unclassified: percentage(segment.unclassified, segment.total),
        },
      };
      continue;
    }
    const dimensionKey = row.dimension as LeadQualityDimension;
    if (!(LEAD_QUALITY_DIMENSIONS as readonly string[]).includes(dimensionKey)) continue;
    if (total < LEAD_QUALITY_MINIMUM_GROUP_SIZE && !COMPLETE_DIMENSIONS.has(dimensionKey)) continue;
    const segment = {
      dimension: dimensionKey,
      key: row.key,
      label: dimensionKey === "origin" ? originLabels[row.key as LeadOrigin] ?? row.label
        : dimensionKey === "origin_shift" ? `${originLabels[row.key.split(":")[0] as LeadOrigin] ?? row.key} · Turno ${row.key.split(":")[1]}`
        : row.label,
      total,
      hot: numberValue(row.hot),
      warm: numberValue(row.warm),
      cold: numberValue(row.cold),
      unclassified: numberValue(row.unclassified),
      converted: numberValue(row.converted),
      hotWarmConverted: numberValue(row.hotWarmConverted),
      assigned: numberValue(row.assigned),
      metaAttributed: numberValue(row.metaAttributed),
      averageFirstContactSeconds: row.averageFirstContactSeconds == null ? null : numberValue(row.averageFirstContactSeconds),
    };
    segments[dimensionKey].push({ ...segment, ...leadQualityRates(segment) });
  }

  for (const dimensionKey of LEAD_QUALITY_DIMENSIONS) {
    segments[dimensionKey] = segments[dimensionKey]
      .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label, "pt-BR"))
      .slice(0, dimensionKey === "hour" ? 168 : COMPLETE_DIMENSIONS.has(dimensionKey) ? undefined : MAX_SEGMENTS_PER_DIMENSION);
  }

  const resolvedSummary = summary ?? {
    total: 0, hot: 0, warm: 0, cold: 0, unclassified: 0, classified: 0, converted: 0,
    hotWarmConverted: 0, assigned: 0, metaAttributed: 0, averageFirstContactSeconds: null,
    classificationCoverage: 0, hotWarmShare: 0, hotWarmConversionRate: 0, conversionRate: 0,
    assignedRate: 0, metaAdAttributionCoverage: 0, temperatureDistribution: { hot: 0, warm: 0, cold: 0, unclassified: 0 },
  };

  let focusedLeads: LeadQualityLead[] = [];
  let focusedLeadCount = 0;
  if (focus && resolvedSummary.total > 0) {
    const selectedDimension = segments[focus.dimension].find((segment) => segment.key === focus.key);
    focusedLeadCount = selectedDimension?.total ?? 0;
    if (focusedLeadCount >= LEAD_QUALITY_MINIMUM_GROUP_SIZE) {
      const rows = await db.select({
        id: schema.leads.id,
        name: schema.leads.nome,
        status: schema.leads.status,
        qualificationStatus: schema.leads.qualificationStatus,
        createdAt: schema.leads.createdAt,
        queueName: schema.leadQueues.name,
        brokerName: schema.user.name,
      }).from(schema.leads)
        .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.tenantId, context.tenantId), eq(schema.leadQueues.id, schema.leads.queueId)))
        .leftJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, schema.leads.corretorId), eq(schema.tenantMemberships.status, "active")))
        .leftJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
        .where(and(
          eq(schema.leads.tenantId, scope.tenantId),
          isNull(schema.leads.deletedAt),
          isNull(schema.leads.archivedAt),
          leadQualityCohortWhere(window, filters),
          scope.leadScope,
          focusWhere(focus),
        ))
        .orderBy(desc(schema.leads.createdAt))
        .limit(MAX_FOCUSED_LEADS + 1);
      focusedLeads = rows.slice(0, MAX_FOCUSED_LEADS).map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
      focusedLeadCount = Math.max(focusedLeadCount, rows.length);
    }
  }

  if (options.audit !== false) await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "report",
    entidadeId: "lead_quality_center",
    acao: focus
      ? `report.lead_quality.drilldown_viewed:${period}:${focus.dimension}`
      : `report.lead_quality.viewed:${period}`,
    createdAt: new Date(),
  });

  return {
    enabled: true,
    period,
    window: serializedWindow,
    filters,
    generatedAt: new Date().toISOString(),
    summary: resolvedSummary,
    segments,
    focus,
    focusedLeads,
    focusedLeadCount,
  };
}

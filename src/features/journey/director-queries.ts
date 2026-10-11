import "server-only";

import { and, count, desc, eq, gte, inArray, isNull, isNotNull, lt, or, sum } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { resolveRules, type EngagementRuleKey } from "@/features/engagement/catalog";
import { journeyMidnight, journeyWeek, shiftJourneyDay } from "@/features/engagement/journey-periods";
import { normalizeNote } from "@/features/engagement/scoring";
import { buildTeamLeaderboard, rankBrokers, type BrokerStanding, type TeamProfile } from "@/features/engagement/leaderboard";
import type { JourneyPointRuleKey } from "@/features/engagement/journey-types";
import { resolveJourneyManagementScope } from "./director-access";
import { journeyZScore } from "./journey-policies";
import type { JourneyCampaignAudienceOptions, JourneyCampaignRow, JourneyDirectorDashboard, JourneyRiskReport, JourneyRulesData, JourneyUnitSummary } from "./director-types";

export type JourneyDirectorPageData = {
  dashboard: JourneyDirectorDashboard | null;
  campaigns: JourneyCampaignRow[] | null;
  audience: JourneyCampaignAudienceOptions | null;
  rules: JourneyRulesData | null;
  risk: JourneyRiskReport | null;
  canManageRules: boolean;
};

const emptyAdoption = { activeBrokers: 0, scoringBrokers: 0, percentage: 0 };
const pointLabels: Record<EngagementRuleKey | "mission.completed" | "recognition.bonus", string> = {
  "offer.fast_accept": "Aceite rápido", "contact.first": "Primeiro contato", "return.on_time": "Retorno em dia",
  "note.service": "Atendimento registrado", "duty.presence": "Presença no plantão", "sale.approved": "Venda aprovada",
  "mission.completed": "Missão concluída", "recognition.bonus": "Reconhecimento",
};
const adoption = (active: number, scoring: number) => ({ activeBrokers: active, scoringBrokers: scoring, percentage: active ? Math.round(scoring * 100 / active) : 0 });

async function readDashboard(tenantId: string, scope: NonNullable<Awaited<ReturnType<typeof resolveJourneyManagementScope>>>, period: ReturnType<typeof journeyWeek>): Promise<JourneyDirectorDashboard> {
  const empty: JourneyDirectorDashboard = { available: false, period, units: [], teams: [], pointsByRule: [], adoption: emptyAdoption, topMissions: [] };
  if (!scope.brokerIds.length) return { ...empty, available: true };
  const db = getDatabase();
  const previousStart = shiftJourneyDay(period.startsAt, -7);
  const [members, teams, currentRows, previousRows, ruleRows, missionRows, branches] = await Promise.all([
    db.select({ brokerId: schema.tenantMemberships.userId, branchId: schema.tenantMemberships.branchId, supervisorId: schema.tenantMemberships.supervisorId, optedOut: schema.tenantMemberships.rankingOptOut, name: schema.user.name, imageUrl: schema.user.image, active: schema.user.active })
      .from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(eq(schema.tenantMemberships.tenantId, tenantId), inArray(schema.tenantMemberships.userId, scope.brokerIds), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active"))).catch(() => null),
    db.select({ supervisorId: schema.supervisorTeams.supervisorId, name: schema.supervisorTeams.name, imageUrl: schema.supervisorTeams.imageUrl, branchId: schema.supervisorTeams.branchId })
      .from(schema.supervisorTeams).where(and(eq(schema.supervisorTeams.tenantId, tenantId), scope.supervisorIds.length ? inArray(schema.supervisorTeams.supervisorId, scope.supervisorIds) : inArray(schema.supervisorTeams.supervisorId, ["__none__"]))).catch(() => []),
    db.select({ brokerId: schema.engagementPointEvents.brokerId, points: sum(schema.engagementPointEvents.points) })
      .from(schema.engagementPointEvents).where(and(eq(schema.engagementPointEvents.tenantId, tenantId), isNull(schema.engagementPointEvents.reversedAt), gte(schema.engagementPointEvents.periodDay, period.startsAt), lt(schema.engagementPointEvents.periodDay, period.endsAt)))
      .groupBy(schema.engagementPointEvents.brokerId).catch(() => null),
    db.select({ brokerId: schema.engagementPointEvents.brokerId, points: sum(schema.engagementPointEvents.points) })
      .from(schema.engagementPointEvents).where(and(eq(schema.engagementPointEvents.tenantId, tenantId), isNull(schema.engagementPointEvents.reversedAt), gte(schema.engagementPointEvents.periodDay, previousStart), lt(schema.engagementPointEvents.periodDay, period.startsAt)))
      .groupBy(schema.engagementPointEvents.brokerId).catch(() => null),
    db.select({ ruleKey: schema.engagementPointEvents.ruleKey, points: sum(schema.engagementPointEvents.points), events: count() }).from(schema.engagementPointEvents)
      .where(and(eq(schema.engagementPointEvents.tenantId, tenantId), isNull(schema.engagementPointEvents.reversedAt), gte(schema.engagementPointEvents.periodDay, period.startsAt), lt(schema.engagementPointEvents.periodDay, period.endsAt)))
      .groupBy(schema.engagementPointEvents.ruleKey).catch(() => null),
    db.select({ missionId: schema.engagementMissionProgress.missionId, title: schema.engagementMissions.title, kind: schema.engagementMissions.kind, periodKey: schema.engagementMissionProgress.periodKey })
      .from(schema.engagementMissionProgress).innerJoin(schema.engagementMissions, and(eq(schema.engagementMissions.id, schema.engagementMissionProgress.missionId), eq(schema.engagementMissions.tenantId, tenantId)))
      .where(and(eq(schema.engagementMissionProgress.tenantId, tenantId), isNotNull(schema.engagementMissionProgress.completedAt), gte(schema.engagementMissionProgress.periodKey, period.startsAt), lt(schema.engagementMissionProgress.periodKey, period.endsAt))).catch(() => null),
    db.select({ id: schema.branches.id, name: schema.branches.name }).from(schema.branches).where(and(eq(schema.branches.tenantId, tenantId), eq(schema.branches.status, "active"), scope.branchIds.length ? inArray(schema.branches.id, scope.branchIds) : inArray(schema.branches.id, ["__none__"]))).catch(() => []),
  ]);
  if (!members || !currentRows || !previousRows || !ruleRows || !missionRows) return empty;
  const active = members.filter((row) => row.active);
  const points = new Map(currentRows.map((row) => [row.brokerId, Number(row.points ?? 0)]));
  const priorPoints = new Map(previousRows.map((row) => [row.brokerId, Number(row.points ?? 0)]));
  const standing: BrokerStanding[] = active.map((row) => ({
    brokerId: row.brokerId, name: row.name, imageUrl: row.imageUrl, branchId: row.branchId, supervisorId: row.supervisorId, optedOut: row.optedOut,
    points: points.get(row.brokerId) ?? 0, previousPoints: priorPoints.get(row.brokerId) ?? 0, totalPoints: 0,
  }));
  const branchMap = new Map(branches.filter((row) => scope.branchIds.includes(row.id)).map((row) => [row.id, row.name]));
  const units: JourneyUnitSummary[] = [...branchMap].map(([branchId, branchName]) => {
    const rows = standing.filter((row) => row.branchId === branchId);
    const scored = rows.filter((row) => row.points > 0).length;
    return { branchId, branchName, points: rows.reduce((total, row) => total + row.points, 0), adoption: adoption(rows.length, scored), brokers: rankBrokers(rows).filter((row) => !row.optedOut) };
  });
  const profiles: TeamProfile[] = teams.filter((row) => scope.supervisorIds.includes(row.supervisorId) && branchMap.has(row.branchId));
  const leaderboardTeams = buildTeamLeaderboard(period, standing, profiles).teams;
  const rulePoints = ruleRows.filter((row) => row.ruleKey in pointLabels).map((row) => ({ ruleKey: row.ruleKey as JourneyPointRuleKey, label: pointLabels[row.ruleKey as keyof typeof pointLabels], points: Number(row.points ?? 0), events: Number(row.events) }));
  const missionCounts = new Map<string, { title: string; kind: "daily" | "weekly" | "team" | "campaign"; count: number }>();
  for (const row of missionRows) {
    if (row.kind !== "daily" && row.kind !== "weekly" && row.kind !== "team" && row.kind !== "campaign") continue;
    const current = missionCounts.get(row.missionId) ?? { title: row.title, kind: row.kind, count: 0 };
    current.count += 1; missionCounts.set(row.missionId, current);
  }
  const topMissions = [...missionCounts].map(([missionId, row]) => ({ missionId, title: row.title, kind: row.kind, completed: row.count })).sort((a, b) => b.completed - a.completed || a.title.localeCompare(b.title, "pt-BR")).slice(0, 5);
  return { available: true, period, units, teams: leaderboardTeams.filter((row) => scope.supervisorIds.includes(row.supervisorId)), pointsByRule: rulePoints,
    adoption: adoption(active.length, active.filter((row) => (points.get(row.brokerId) ?? 0) > 0).length), topMissions };
}

async function readRisk(context: TenantContext, scope: NonNullable<Awaited<ReturnType<typeof resolveJourneyManagementScope>>>, period: ReturnType<typeof journeyWeek>): Promise<JourneyRiskReport> {
  const empty: JourneyRiskReport = { available: false, period, brokers: [], events: [] };
  if (!scope.brokerIds.length) return { ...empty, available: true };
  const db = getDatabase();
  const from = period.startsAt;
  const [brokers, events, notes, contacts] = await Promise.all([
    db.select({ id: schema.tenantMemberships.userId, name: schema.user.name, branchId: schema.tenantMemberships.branchId }).from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), inArray(schema.tenantMemberships.userId, scope.brokerIds), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active"))).catch(() => null),
    db.select({ id: schema.engagementPointEvents.id, brokerId: schema.engagementPointEvents.brokerId, ruleKey: schema.engagementPointEvents.ruleKey, points: schema.engagementPointEvents.points, occurredAt: schema.engagementPointEvents.occurredAt, reversedAt: schema.engagementPointEvents.reversedAt, reason: schema.engagementPointEvents.reversalReason, metadata: schema.engagementPointEvents.metadata })
      .from(schema.engagementPointEvents).where(and(eq(schema.engagementPointEvents.tenantId, context.tenantId), inArray(schema.engagementPointEvents.brokerId, scope.brokerIds), gte(schema.engagementPointEvents.periodDay, from)))
      .orderBy(desc(schema.engagementPointEvents.occurredAt)).limit(200).catch(() => null),
    db.select({ userId: schema.leadInteractions.userId, body: schema.leadInteractions.conteudo }).from(schema.leadInteractions)
      .innerJoin(schema.leads, eq(schema.leads.id, schema.leadInteractions.leadId))
      .where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leadInteractions.userId, scope.brokerIds), eq(schema.leadInteractions.tipo, "note"), gte(schema.leadInteractions.createdAt, journeyMidnight(from)))).limit(10_000).catch(() => null),
    db.select({ userId: schema.leadInteractions.userId, leadId: schema.leadInteractions.leadId, createdAt: schema.leadInteractions.createdAt }).from(schema.leadInteractions)
      .innerJoin(schema.leads, eq(schema.leads.id, schema.leadInteractions.leadId))
      .where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leadInteractions.userId, scope.brokerIds), eq(schema.leadInteractions.tipo, "whatsapp_msg"), gte(schema.leadInteractions.createdAt, journeyMidnight(from)))).limit(20_000).catch(() => null),
  ]);
  if (!brokers || !events || !notes || !contacts) return empty;
  const brokerMap = new Map(brokers.map((row) => [row.id, row]));
  const totals = new Map<string, Map<string, { points: number; events: number }>>();
  for (const event of events) {
    if (event.reversedAt || !brokerMap.has(event.brokerId)) continue;
    const byBroker = totals.get(event.ruleKey) ?? new Map();
    const previous = byBroker.get(event.brokerId) ?? { points: 0, events: 0 };
    previous.points += event.points; previous.events += 1; byBroker.set(event.brokerId, previous); totals.set(event.ruleKey, byBroker);
  }
  const duplicated = new Map<string, number>();
  const noteCount = new Map<string, number>();
  for (const row of notes) {
    const normalized = normalizeNote(row.body);
    const key = row.userId + "::" + normalized;
    noteCount.set(key, (noteCount.get(key) ?? 0) + 1);
  }
  for (const [key, n] of noteCount) if (n > 1) {
    const id = key.slice(0, key.indexOf("::"));
    duplicated.set(id, (duplicated.get(id) ?? 0) + n - 1);
  }
  const messages = new Map<string, number>();
  for (const row of contacts) {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(row.createdAt);
    const key = row.userId + ":" + row.leadId + ":" + day;
    messages.set(key, (messages.get(key) ?? 0) + 1);
  }
  const unusual = new Map<string, number>();
  // Repeated outbound WhatsApp logs above ten for the same lead/day are a review signal.
  for (const [key, n] of messages) if (n > 10) {
    const id = key.slice(0, key.indexOf(":"));
    unusual.set(id, (unusual.get(id) ?? 0) + n - 10);
  }
  const brokerPoints = new Map<string, number>();
  for (const rows of totals.values()) for (const [id, row] of rows) brokerPoints.set(id, (brokerPoints.get(id) ?? 0) + row.points);
  const riskBrokers = [...brokerMap.values()].map((broker) => {
    const rules = [...totals].flatMap(([key, rows]) => {
      const row = rows.get(broker.id);
      if (!row) return [];
      const score = journeyZScore(scope.brokerIds.map((id) => rows.get(id)?.points ?? 0), row.points);
      return [{ ruleKey: key as JourneyPointRuleKey, label: pointLabels[key as keyof typeof pointLabels] ?? key, points: row.points, events: row.events, zScore: score, outlier: score >= 3 }];
    });
    return { brokerId: broker.id, name: broker.name, branchId: broker.branchId, points: brokerPoints.get(broker.id) ?? 0, rules, repeatedNotes: duplicated.get(broker.id) ?? 0, unusualContacts: unusual.get(broker.id) ?? 0 };
  }).filter((broker) => broker.points > 0 || broker.repeatedNotes > 0 || broker.unusualContacts > 0 || broker.rules.some((rule) => rule.outlier));
  const riskEvents = events.flatMap((event) => {
    const broker = brokerMap.get(event.brokerId);
    if (!broker) return [];
    const title = typeof event.metadata?.title === "string" ? event.metadata.title : typeof event.metadata?.label === "string" ? event.metadata.label : null;
    return [{ id: event.id, brokerId: broker.id, brokerName: broker.name, ruleKey: event.ruleKey as JourneyPointRuleKey, points: event.points, occurredAt: event.occurredAt.toISOString(), reversedAt: event.reversedAt?.toISOString() ?? null, detail: title ?? event.reason }];
  });
  return { available: true, period, brokers: riskBrokers, events: riskEvents };
}

export async function getDirectorJourneyPageData(context: TenantContext): Promise<JourneyDirectorPageData> {
  const empty: JourneyDirectorPageData = { dashboard: null, campaigns: null, audience: null, rules: null, risk: null, canManageRules: context.role === "director" };
  if (context.role !== "director" && context.role !== "manager") return empty;
  const scope = await resolveJourneyManagementScope(context);
  if (!scope) return empty;
  const period = journeyWeek(new Date());
  const db = getDatabase();
  const [journey, campaignFlag, rankingFlag, dashboard, settings, storedCampaigns] = await Promise.all([
    getFeatureFlag(FEATURE_FLAGS.BROKER_JOURNEY).catch(() => "false"),
    getFeatureFlag(FEATURE_FLAGS.ENGAGEMENT_CAMPAIGNS).catch(() => "false"),
    getFeatureFlag(FEATURE_FLAGS.TEAM_RANKING).catch(() => "false"),
    readDashboard(context.tenantId, scope, period).catch(() => null),
    db.select().from(schema.engagementSettings).where(eq(schema.engagementSettings.tenantId, context.tenantId)).limit(1).catch(() => []),
    db.select().from(schema.engagementMissions).where(and(eq(schema.engagementMissions.tenantId, context.tenantId), eq(schema.engagementMissions.kind, "campaign"), context.role === "director" ? undefined : eq(schema.engagementMissions.createdBy, context.userId))).orderBy(desc(schema.engagementMissions.createdAt)).limit(100).catch(() => null),
  ]);
  const campaignsEnabled = journey === "true" && campaignFlag === "true";
  const resolvedRules = resolveRules(settings[0]?.rules);
  const [branches, teams, duties, brokers, risk] = await Promise.all([
    db.select({ id: schema.branches.id, name: schema.branches.name }).from(schema.branches).where(and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active"), scope.branchIds.length ? inArray(schema.branches.id, scope.branchIds) : inArray(schema.branches.id, ["__none__"]))).catch(() => []),
    db.select({ id: schema.supervisorTeams.supervisorId, name: schema.supervisorTeams.name, branchId: schema.supervisorTeams.branchId }).from(schema.supervisorTeams).where(and(eq(schema.supervisorTeams.tenantId, context.tenantId), scope.supervisorIds.length ? inArray(schema.supervisorTeams.supervisorId, scope.supervisorIds) : inArray(schema.supervisorTeams.supervisorId, ["__none__"]))).catch(() => []),
    db.select({ id: schema.unitDutySchedules.id, name: schema.unitDutySchedules.name, branchId: schema.unitDutySchedules.branchId }).from(schema.unitDutySchedules).where(and(eq(schema.unitDutySchedules.tenantId, context.tenantId), eq(schema.unitDutySchedules.status, "active"), scope.role === "director" ? or(inArray(schema.unitDutySchedules.branchId, scope.branchIds.length ? scope.branchIds : ["__none__"]), isNull(schema.unitDutySchedules.branchId)) : scope.branchIds.length ? inArray(schema.unitDutySchedules.branchId, scope.branchIds) : inArray(schema.unitDutySchedules.id, ["__none__"]))).catch(() => []),
    db.select({ id: schema.tenantMemberships.userId, name: schema.user.name, branchId: schema.tenantMemberships.branchId }).from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active"), scope.brokerIds.length ? inArray(schema.tenantMemberships.userId, scope.brokerIds) : inArray(schema.tenantMemberships.userId, ["__none__"]))).catch(() => []),
    context.role === "director" && campaignsEnabled ? readRisk(context, scope, period).catch(() => null) : Promise.resolve(null),
  ]);
  const campaigns: JourneyCampaignRow[] | null = campaignsEnabled && storedCampaigns ? storedCampaigns.map((row) => ({
    id: row.id, kind: "campaign", title: row.title, description: row.description, metric: row.metric as JourneyCampaignRow["metric"], target: row.target, bonusPoints: row.bonusPoints,
    period: "campaign", audience: row.audience as JourneyCampaignRow["audience"], startsAt: row.startsAt?.toISOString() ?? null, endsAt: row.endsAt?.toISOString() ?? null,
    status: row.status === "inactive" ? "inactive" : "active", createdBy: row.createdBy, createdAt: row.createdAt.toISOString(),
  })) : null;
  return {
    dashboard: journey === "true" ? {
      ...(dashboard ?? { available: false, period, units: [], teams: [], pointsByRule: [], adoption: emptyAdoption, topMissions: [] }),
      units: rankingFlag === "true" ? dashboard?.units ?? [] : [],
      teams: rankingFlag === "true" ? dashboard?.teams ?? [] : [],
    } : null,
    campaigns,
    audience: { available: campaignsEnabled && Boolean(storedCampaigns), branches: branches.map((row) => ({ id: row.id, name: row.name, branchId: row.id })), teams: teams.map((row) => ({ id: row.id, name: row.name, branchId: row.branchId })), duties: duties.map((row) => ({ id: row.id, name: row.name, branchId: row.branchId })), brokers: brokers.map((row) => ({ id: row.id, name: row.name, branchId: row.branchId })) },
    // Company settings, but only the director edits them: managers and supervisors get nothing (Vigia T58/T59).
    rules: campaignsEnabled && context.role === "director" ? { available: true, rules: Object.values(resolvedRules) } : { available: false, rules: [] },
    risk: risk ?? (context.role === "director" && campaignsEnabled ? { available: false, period, brokers: [], events: [] } : null),
    canManageRules: context.role === "director" && campaignsEnabled,
  };
}

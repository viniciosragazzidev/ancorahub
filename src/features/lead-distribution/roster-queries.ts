import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

export type DutyRosterSnapshot = Awaited<ReturnType<typeof getDutyRosterSnapshot>>;

export async function getDutyRosterSnapshot(context: TenantContext) {
  const db = getDatabase();
  const branchCondition = context.role === "manager" && context.branchId
    ? and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.id, context.branchId))
    : eq(schema.branches.tenantId, context.tenantId);
  const branches = await db
    .select({ id: schema.branches.id, name: schema.branches.name, isDistributionHub: schema.branches.isDistributionHub })
    .from(schema.branches)
    .where(branchCondition)
    .orderBy(asc(schema.branches.name));
  const branchIds = branches.map((branch) => branch.id);
  if (!branchIds.length) return { branches: [], queues: [], credentials: [], schedules: [], brokers: [], assignments: [], publishedAssignments: [], history: [] };

  const [queues, credentials, schedules, brokers, assignments, campaignOrigins] = await Promise.all([
    db.select({ id: schema.leadQueues.id, branchId: schema.leadQueues.branchId, name: schema.leadQueues.name })
      .from(schema.leadQueues)
      .where(and(eq(schema.leadQueues.tenantId, context.tenantId), inArray(schema.leadQueues.branchId, branchIds), eq(schema.leadQueues.status, "active")))
      .orderBy(asc(schema.leadQueues.name)),
    db.select({
      id: schema.leadWebhookCredentials.id,
      name: sql<string>`CASE WHEN ${schema.leadWebhookCredentials.source} = 'meta_lead_ads' AND ${schema.metaPages.name} IS NOT NULL THEN 'Meta Lead Ads · ' || ${schema.metaPages.name} ELSE ${schema.leadWebhookCredentials.name} END`,
    })
      .from(schema.leadWebhookCredentials)
      .leftJoin(schema.metaLeadAdSources, and(
        eq(schema.metaLeadAdSources.leadWebhookCredentialId, schema.leadWebhookCredentials.id),
        eq(schema.metaLeadAdSources.tenantId, schema.leadWebhookCredentials.tenantId),
      ))
      .leftJoin(schema.metaPages, and(
        eq(schema.metaPages.pageId, schema.metaLeadAdSources.pageId),
        eq(schema.metaPages.tenantId, schema.leadWebhookCredentials.tenantId),
      ))
      .where(and(eq(schema.leadWebhookCredentials.tenantId, context.tenantId), eq(schema.leadWebhookCredentials.status, "active")))
      .orderBy(asc(schema.leadWebhookCredentials.name)),
    db.select({
      id: schema.unitDutySchedules.id,
      branchId: schema.unitDutySchedules.branchId,
      branchName: schema.branches.name,
      queueId: schema.unitDutySchedules.queueId,
      queueName: schema.leadQueues.name,
      name: schema.unitDutySchedules.name,
      typeName: schema.dutyScheduleTypes.name,
      dayOfWeek: schema.unitDutySchedules.dayOfWeek,
      startsAt: schema.unitDutySchedules.startsAt,
      endsAt: schema.unitDutySchedules.endsAt,
      priority: schema.unitDutySchedules.priority,
      minimumBrokers: schema.unitDutySchedules.minimumBrokers,
      maximumBrokers: schema.unitDutySchedules.maximumBrokers,
      maxLeadsPerBroker: schema.unitDutySchedules.maxLeadsPerBroker,
      shiftSplitAt: schema.unitDutySchedules.shiftSplitAt,
      status: schema.unitDutySchedules.status,
      timezone: schema.unitDutySchedules.timezone,
      validFrom: schema.unitDutySchedules.validFrom,
      validUntil: schema.unitDutySchedules.validUntil,
      webhookCredentialId: schema.unitDutySchedules.webhookCredentialId,
      credentialName: sql<string>`CASE WHEN ${schema.leadWebhookCredentials.source} = 'meta_lead_ads' AND ${schema.metaPages.name} IS NOT NULL THEN 'Meta Lead Ads · ' || ${schema.metaPages.name} ELSE ${schema.leadWebhookCredentials.name} END`,
    })
      .from(schema.unitDutySchedules)
      .leftJoin(schema.branches, eq(schema.unitDutySchedules.branchId, schema.branches.id))
      .leftJoin(schema.leadQueues, eq(schema.unitDutySchedules.queueId, schema.leadQueues.id))
      .leftJoin(schema.dutyScheduleTypes, and(eq(schema.unitDutySchedules.typeId, schema.dutyScheduleTypes.id), eq(schema.unitDutySchedules.tenantId, schema.dutyScheduleTypes.tenantId)))
      .leftJoin(schema.leadWebhookCredentials, eq(schema.unitDutySchedules.webhookCredentialId, schema.leadWebhookCredentials.id))
      .leftJoin(schema.metaLeadAdSources, and(
        eq(schema.metaLeadAdSources.leadWebhookCredentialId, schema.leadWebhookCredentials.id),
        eq(schema.metaLeadAdSources.tenantId, schema.unitDutySchedules.tenantId),
      ))
      .leftJoin(schema.metaPages, and(
        eq(schema.metaPages.pageId, schema.metaLeadAdSources.pageId),
        eq(schema.metaPages.tenantId, schema.unitDutySchedules.tenantId),
      ))
      .where(and(
        eq(schema.unitDutySchedules.tenantId, context.tenantId),
        or(inArray(schema.unitDutySchedules.branchId, branchIds), isNull(schema.unitDutySchedules.branchId)),
      ))
      .orderBy(asc(schema.unitDutySchedules.dayOfWeek), asc(schema.unitDutySchedules.startsAt)),
    db.select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      internalCode: schema.brokerProfiles.internalCode,
      branchId: schema.tenantMemberships.branchId,
      branchName: schema.branches.name,
      availabilityStatus: schema.tenantMemberships.availabilityStatus,
    })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .leftJoin(schema.branches, and(eq(schema.tenantMemberships.branchId, schema.branches.id), eq(schema.branches.tenantId, context.tenantId)))
      .leftJoin(schema.brokerProfiles, and(
        eq(schema.brokerProfiles.userId, schema.user.id),
        eq(schema.brokerProfiles.tenantId, context.tenantId),
      ))
      .where(and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        inArray(schema.tenantMemberships.branchId, branchIds),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.jobTitle, "broker"),
        eq(schema.tenantMemberships.status, "active"),
        eq(schema.user.active, true),
        eq(schema.user.status, "active"),
      ))
      .orderBy(asc(schema.user.name)),
    db.select({
      id: schema.dutyRosterAssignments.id,
      branchId: schema.dutyRosterAssignments.branchId,
      scheduleId: schema.dutyRosterAssignments.scheduleId,
      brokerId: schema.dutyRosterAssignments.brokerId,
      dayOfWeek: schema.dutyRosterAssignments.dayOfWeek,
      startsAt: schema.dutyRosterAssignments.startsAt,
      endsAt: schema.dutyRosterAssignments.endsAt,
      status: schema.dutyRosterAssignments.status,
      brokerName: schema.user.name,
    })
      .from(schema.dutyRosterAssignments)
      .innerJoin(schema.user, eq(schema.dutyRosterAssignments.brokerId, schema.user.id))
      .where(and(
        eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
        inArray(schema.dutyRosterAssignments.branchId, branchIds),
        eq(schema.dutyRosterAssignments.status, "active"),
        // Published monthly rows are one-date occurrences, not part of the weekly roster.
        isNull(schema.dutyRosterAssignments.dutyDate),
      ))
      .orderBy(asc(schema.dutyRosterAssignments.dayOfWeek), asc(schema.dutyRosterAssignments.startsAt)),
    db.select({
      credentialId: schema.leads.webhookCredentialId,
      campaignId: schema.leads.metaCampaignId,
      campaignName: schema.metaCampaigns.name,
    })
      .from(schema.leads)
      .innerJoin(schema.metaCampaigns, and(
        eq(schema.metaCampaigns.tenantId, schema.leads.tenantId),
        eq(schema.metaCampaigns.campaignId, schema.leads.metaCampaignId),
      ))
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        isNotNull(schema.leads.webhookCredentialId),
        isNotNull(schema.leads.metaCampaignId),
      ))
      .groupBy(schema.leads.webhookCredentialId, schema.leads.metaCampaignId, schema.metaCampaigns.name),
  ]);

  const campaignNamesByCredential = new Map<string, string[]>();
  for (const origin of campaignOrigins) {
    if (!origin.credentialId || !origin.campaignName) continue;
    const names = campaignNamesByCredential.get(origin.credentialId) ?? [];
    if (!names.includes(origin.campaignName)) names.push(origin.campaignName);
    campaignNamesByCredential.set(origin.credentialId, names);
  }
  const displayCredentialName = (credentialId: string | null, fallback: string | null) => {
    if (!credentialId) return fallback;
    const campaignNames = campaignNamesByCredential.get(credentialId) ?? [];
    if (!campaignNames.length) return fallback;
    const preview = campaignNames.slice(0, 2).join(", ");
    const suffix = campaignNames.length > 2 ? ` +${campaignNames.length - 2}` : "";
    return `Meta Lead Ads · ${preview}${suffix}`;
  };
  const displayCredentials = credentials.map((credential) => ({
    ...credential,
    name: displayCredentialName(credential.id, credential.name) ?? credential.name,
  }));
  // Which queue receives each plantão: the queue's exclusivity list (what the
  // Filas page edits), not the legacy per-schedule queue_id.
  const linkingQueues = schedules.length
    ? await db.select({ id: schema.leadQueues.id, name: schema.leadQueues.name, exclusiveDutyScheduleIds: schema.leadQueues.exclusiveDutyScheduleIds, exclusiveDutyScheduleId: schema.leadQueues.exclusiveDutyScheduleId })
      .from(schema.leadQueues)
      .where(eq(schema.leadQueues.tenantId, context.tenantId))
      .orderBy(asc(schema.leadQueues.name))
    : [];
  // A plantão may serve several queues (each queue's list holds it).
  const linkedQueuesBySchedule = new Map<string, { id: string; name: string }[]>();
  for (const queue of linkingQueues) {
    for (const id of new Set([...(queue.exclusiveDutyScheduleIds ?? []), ...(queue.exclusiveDutyScheduleId ? [queue.exclusiveDutyScheduleId] : [])])) {
      linkedQueuesBySchedule.set(id, [...(linkedQueuesBySchedule.get(id) ?? []), { id: queue.id, name: queue.name }]);
    }
  }
  const displaySchedules = schedules.map((schedule) => ({
    ...schedule,
    branchName: schedule.branchName ?? "Todas as unidades",
    linkedQueues: linkedQueuesBySchedule.get(schedule.id) ?? [],
    linkedQueueId: linkedQueuesBySchedule.get(schedule.id)?.[0]?.id ?? null,
    queueName: linkedQueuesBySchedule.get(schedule.id)?.map((queue) => queue.name).join(", ") || schedule.queueName || "Sem fila vinculada",
    credentialName: displayCredentialName(schedule.webhookCredentialId, schedule.credentialName),
  }));

  const scheduleIds = schedules.map((schedule) => schedule.id);
  const history = scheduleIds.length
    ? await db.select({
      scheduleId: schema.auditLogs.entidadeId,
      action: schema.auditLogs.acao,
      createdAt: schema.auditLogs.createdAt,
      actorName: schema.user.name,
    })
      .from(schema.auditLogs)
      .innerJoin(schema.user, eq(schema.auditLogs.userId, schema.user.id))
      .where(and(eq(schema.auditLogs.entidade, "unit_duty_schedule"), inArray(schema.auditLogs.entidadeId, scheduleIds)))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(100)
    : [];

  // Published monthly escala (DEC-123): one row per broker per date. Shown next
  // to the weekly roster; from the start of the current month on.
  const monthStart = `${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7)}-01`;
  const publishedAssignments = scheduleIds.length
    ? await db.select({
      id: schema.dutyRosterAssignments.id,
      scheduleId: schema.dutyRosterAssignments.scheduleId,
      brokerId: schema.dutyRosterAssignments.brokerId,
      brokerName: schema.user.name,
      dutyDate: sql<string>`${schema.dutyRosterAssignments.dutyDate}::text`,
    })
      .from(schema.dutyRosterAssignments)
      .innerJoin(schema.user, eq(schema.dutyRosterAssignments.brokerId, schema.user.id))
      .where(and(
        eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
        inArray(schema.dutyRosterAssignments.branchId, branchIds),
        inArray(schema.dutyRosterAssignments.scheduleId, scheduleIds),
        eq(schema.dutyRosterAssignments.status, "active"),
        isNotNull(schema.dutyRosterAssignments.monthlyPlanId),
        sql`${schema.dutyRosterAssignments.dutyDate} >= ${monthStart}::date`,
      ))
      .orderBy(asc(schema.dutyRosterAssignments.dutyDate), asc(schema.user.name))
    : [];

  return { branches, queues, credentials: displayCredentials, schedules: displaySchedules, brokers, assignments, publishedAssignments, history };
}

"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { journeyUserIdSchema } from "@/features/engagement/journey-validation";
import type { CreateJourneyCampaignInput, JourneyActionResponse, JourneyCampaignRow } from "./director-types";
import { resolveJourneyManagementScope } from "./director-access";

const campaignSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(200).optional(),
  metric: z.enum(["contacts.fast_coverage", "returns.cleared", "notes.coverage", "steps.coverage", "offers.fast_coverage", "contacts.days_on_time", "contacts.evidenced", "contacts.on_time", "sla.no_breach"]),
  target: z.number().int().min(1).max(1_000),
  bonusPoints: z.number().int().min(1).max(500),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  audience: z.object({
    branchIds: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
    supervisorIds: z.array(journeyUserIdSchema).max(100).optional(),
    dutyScheduleIds: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
    userIds: z.array(journeyUserIdSchema).max(100).optional(),
  }).strict(),
}).strict();
const idSchema = z.string().trim().min(1).max(80);

function rowToCampaign(row: typeof schema.engagementMissions.$inferSelect): JourneyCampaignRow {
  return { id: row.id, kind: "campaign", title: row.title, description: row.description, metric: row.metric as JourneyCampaignRow["metric"], target: row.target,
    bonusPoints: row.bonusPoints, period: "campaign", audience: row.audience as JourneyCampaignRow["audience"], startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null, status: row.status === "inactive" ? "inactive" : "active", createdBy: row.createdBy, createdAt: row.createdAt.toISOString() };
}

async function campaignActor() {
  const context = await getRequiredTenantContext();
  if (!["director", "manager", "supervisor"].includes(context.role)) return null;
  if (await getFeatureFlag(FEATURE_FLAGS.BROKER_JOURNEY).catch(() => "false") !== "true") return null;
  if (await getFeatureFlag(FEATURE_FLAGS.ENGAGEMENT_CAMPAIGNS).catch(() => "false") !== "true") return null;
  const scope = await resolveJourneyManagementScope(context);
  return scope ? { context, scope } : null;
}

async function resolveAudience(input: CreateJourneyCampaignInput["audience"], scope: NonNullable<Awaited<ReturnType<typeof resolveJourneyManagementScope>>>) {
  const db = getDatabase();
  const branchIds = [...new Set(input.branchIds ?? [])];
  const supervisorIds = [...new Set(input.supervisorIds ?? [])];
  const dutyIds = [...new Set(input.dutyScheduleIds ?? [])];
  const userIds = [...new Set(input.userIds ?? [])];
  const hasSelection = branchIds.length + supervisorIds.length + dutyIds.length + userIds.length > 0;
  if (branchIds.some((id) => !scope.branchIds.includes(id))) return null;
  if (supervisorIds.some((id) => !scope.supervisorIds.includes(id))) return null;
  if (userIds.some((id) => !scope.brokerIds.includes(id))) return null;
  if (dutyIds.length) {
    const schedules = await db.select({ id: schema.unitDutySchedules.id, branchId: schema.unitDutySchedules.branchId }).from(schema.unitDutySchedules)
      .where(and(eq(schema.unitDutySchedules.tenantId, scope.tenantId), inArray(schema.unitDutySchedules.id, dutyIds), eq(schema.unitDutySchedules.status, "active"))).catch(() => null);
    if (!schedules || schedules.length !== dutyIds.length || schedules.some((row) => row.branchId === null ? scope.role !== "director" : !scope.branchIds.includes(row.branchId))) return null;
  }
  if (!hasSelection) {
    if (scope.role === "supervisor") return { supervisorIds: [scope.userId] };
    return scope.branchIds.length ? { branchIds: scope.branchIds } : {};
  }
  return {
    ...(branchIds.length ? { branchIds } : {}),
    ...(supervisorIds.length ? { supervisorIds } : {}),
    ...(dutyIds.length ? { dutyScheduleIds: dutyIds } : {}),
    ...(userIds.length ? { userIds } : {}),
  };
}

export async function createJourneyCampaignAction(input: CreateJourneyCampaignInput): Promise<JourneyActionResponse<JourneyCampaignRow>> {
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Confira o nome, a meta, o período e o público da campanha." };
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  if (endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 180 * 86_400_000) return { ok: false, message: "O período deve durar até 180 dias." };
  const actor = await campaignActor().catch(() => null);
  if (!actor) return { ok: false, message: "Campanhas indisponíveis para este perfil." };
  const audience = await resolveAudience(parsed.data.audience, actor.scope).catch(() => null);
  if (!audience) return { ok: false, message: "O público escolhido está fora do seu escopo." };
  const now = new Date();
  const values = { id: randomUUID(), tenantId: actor.context.tenantId, kind: "campaign", title: parsed.data.title, description: parsed.data.description ?? "",
    metric: parsed.data.metric, target: parsed.data.target, bonusPoints: parsed.data.bonusPoints, period: "campaign", audience,
    startsAt, endsAt, status: "active", createdBy: actor.context.userId, createdAt: now, updatedAt: now } as const;
  try {
    const [row] = await getDatabase().insert(schema.engagementMissions).values(values).returning();
    if (!row) return { ok: false, message: "Não foi possível criar a campanha." };
    await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId: actor.context.userId, entidade: "engagement_mission", entidadeId: row.id, acao: "campaign.created", createdAt: now });
    return { ok: true, data: rowToCampaign(row) };
  } catch {
    return { ok: false, message: "Não foi possível criar a campanha agora." };
  }
}

export async function pauseJourneyCampaignAction(campaignId: string): Promise<JourneyActionResponse> {
  const id = idSchema.safeParse(campaignId);
  if (!id.success) return { ok: false, message: "Campanha inválida." };
  const actor = await campaignActor().catch(() => null);
  if (!actor) return { ok: false, message: "Campanhas indisponíveis para este perfil." };
  const db = getDatabase();
  try {
    return await db.transaction(async (tx) => {
      const [campaign] = await tx.select().from(schema.engagementMissions).where(and(eq(schema.engagementMissions.tenantId, actor.context.tenantId), eq(schema.engagementMissions.id, id.data), eq(schema.engagementMissions.kind, "campaign"))).limit(1).for("update");
      if (!campaign || (actor.context.role !== "director" && campaign.createdBy !== actor.context.userId)) return { ok: false, message: "Campanha não encontrada no seu escopo." } as const;
      if (actor.context.role !== "director") {
        const storedAudience = campaign.audience as CreateJourneyCampaignInput["audience"];
        const hasBoundAudience = Boolean(storedAudience.branchIds?.length || storedAudience.supervisorIds?.length || storedAudience.dutyScheduleIds?.length || storedAudience.userIds?.length);
        if (!hasBoundAudience || !await resolveAudience(storedAudience, actor.scope).catch(() => null)) return { ok: false, message: "Campanha fora do seu escopo atual." } as const;
      }
      if (campaign.status === "inactive") return { ok: true } as const;
      const now = new Date();
      await tx.update(schema.engagementMissions).set({ status: "inactive", updatedAt: now }).where(and(eq(schema.engagementMissions.tenantId, actor.context.tenantId), eq(schema.engagementMissions.id, id.data)));
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: actor.context.userId, entidade: "engagement_mission", entidadeId: campaign.id, acao: "campaign.paused", createdAt: now });
      return { ok: true } as const;
    });
  } catch {
    return { ok: false, message: "Não foi possível pausar a campanha." };
  }
}

export async function createCampaign(input: CreateJourneyCampaignInput): Promise<JourneyActionResponse<JourneyCampaignRow>> {
  return createJourneyCampaignAction(input);
}

export async function pauseCampaign(campaignId: string): Promise<JourneyActionResponse> {
  return pauseJourneyCampaignAction(campaignId);
}

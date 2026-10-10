import "server-only";

import { and, asc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { z } from "zod";

import { getLocalDutyParts } from "@/features/leads/assignment";
import { periodDay } from "@/features/engagement/scoring";
import { getManagerBranchIds } from "@/features/team/manager-branches-service";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

/**
 * Who a message goes to. The browser only sends this description; the list of
 * people is always resolved here, inside the sender's scope (plan §8.3).
 */
export const audienceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("people"), userIds: z.array(z.string().min(1).max(80)).min(1).max(500) }),
  z.object({ kind: z.literal("branches"), branchIds: z.array(z.string().min(1).max(80)).min(1).max(50) }),
  z.object({ kind: z.literal("duty_today"), typeIds: z.array(z.string().min(1).max(80)).max(50).default([]) }),
  z.object({ kind: z.literal("team"), supervisorId: z.string().min(1).max(80).optional() }),
  z.object({ kind: z.literal("all") }),
]);
export type Audience = z.infer<typeof audienceSchema>;

export const SENDER_ROLES = ["director", "manager", "supervisor"] as const;
export const canSend = (context: Pick<TenantContext, "role">) => (SENDER_ROLES as readonly string[]).includes(context.role);

export type ScopedBroker = { id: string; name: string; branchId: string | null; branchName: string | null; supervisorId: string | null };

/** Active brokers the sender may reach: director all, manager their units, supervisor their team. */
export async function brokersInScope(context: TenantContext): Promise<ScopedBroker[]> {
  if (!canSend(context)) return [];
  const db = getDatabase();
  const memberships = schema.tenantMemberships;
  let scope;
  if (context.role === "manager") {
    const branchIds = [...new Set([context.branchId, ...(await getManagerBranchIds(context.tenantId, context.userId))].filter((id): id is string => Boolean(id)))];
    if (!branchIds.length) return [];
    scope = inArray(memberships.branchId, branchIds);
  } else if (context.role === "supervisor") {
    scope = eq(memberships.supervisorId, context.userId);
  }
  return db.select({ id: schema.user.id, name: schema.user.name, branchId: memberships.branchId, branchName: schema.branches.name, supervisorId: memberships.supervisorId })
    .from(memberships)
    .innerJoin(schema.user, eq(schema.user.id, memberships.userId))
    .leftJoin(schema.branches, and(eq(schema.branches.id, memberships.branchId), eq(schema.branches.tenantId, memberships.tenantId)))
    .where(and(
      eq(memberships.tenantId, context.tenantId),
      eq(memberships.role, "broker"),
      eq(memberships.status, "active"),
      eq(schema.user.active, true),
      eq(schema.user.status, "active"),
      scope,
    ))
    .orderBy(asc(schema.user.name));
}

/** Brokers with a plantão today (weekly roster or published occurrence), optionally of some plantão types. */
async function brokersOnDutyToday(tenantId: string, typeIds: string[], now: Date) {
  const roster = schema.dutyRosterAssignments;
  const schedules = schema.unitDutySchedules;
  const local = getLocalDutyParts(now);
  const rows = await getDatabase().selectDistinct({ brokerId: roster.brokerId })
    .from(roster)
    .innerJoin(schedules, and(eq(schedules.id, roster.scheduleId), eq(schedules.tenantId, roster.tenantId)))
    .where(and(
      eq(roster.tenantId, tenantId),
      eq(roster.status, "active"),
      eq(schedules.status, "active"),
      typeIds.length ? inArray(schedules.typeId, typeIds) : undefined,
      or(
        eq(roster.dutyDate, periodDay(now)),
        and(isNull(roster.dutyDate), eq(roster.dayOfWeek, local.weekday), lte(roster.validFrom, now), or(isNull(roster.validUntil), gt(roster.validUntil, now))),
      ),
    ));
  return new Set(rows.map((row) => row.brokerId));
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** The people of an audience (within the sender's scope) and a short label for the history. */
export async function resolveAudience(context: TenantContext, audience: Audience, now = new Date()): Promise<{ brokers: ScopedBroker[]; label: string }> {
  if (audience.kind === "all" && context.role !== "director") throw new Error("Só a diretoria envia para todos.");
  const base = await brokersInScope(context);
  switch (audience.kind) {
    case "all":
      return { brokers: base, label: "Todos os corretores" };
    case "people": {
      const wanted = new Set(audience.userIds);
      const brokers = base.filter((broker) => wanted.has(broker.id));
      return { brokers, label: brokers.length === 1 ? brokers[0]!.name : plural(brokers.length, "corretor", "corretores") };
    }
    case "branches": {
      const wanted = new Set(audience.branchIds);
      const brokers = base.filter((broker) => broker.branchId && wanted.has(broker.branchId));
      const names = [...new Set(brokers.map((broker) => broker.branchName).filter(Boolean))];
      return { brokers, label: names.length === 1 ? `Unidade ${names[0]}` : plural(audience.branchIds.length, "unidade", "unidades") };
    }
    case "duty_today": {
      const onDuty = await brokersOnDutyToday(context.tenantId, audience.typeIds, now);
      return { brokers: base.filter((broker) => onDuty.has(broker.id)), label: audience.typeIds.length ? "Plantão de hoje (tipos escolhidos)" : "Plantão de hoje" };
    }
    case "team": {
      const supervisorId = context.role === "supervisor" ? context.userId : audience.supervisorId;
      if (!supervisorId) throw new Error("Escolha o supervisor da equipe.");
      const brokers = base.filter((broker) => broker.supervisorId === supervisorId);
      return { brokers, label: "Equipe do supervisor" };
    }
  }
}

/** What the composer offers, already limited to the sender's scope. */
export async function getAudienceOptions(context: TenantContext) {
  const brokers = await brokersInScope(context);
  const db = getDatabase();
  const branchMap = new Map<string, string>();
  for (const broker of brokers) if (broker.branchId && broker.branchName) branchMap.set(broker.branchId, broker.branchName);
  const supervisorIds = [...new Set(brokers.map((broker) => broker.supervisorId).filter((id): id is string => Boolean(id)))];
  const [types, supervisors] = await Promise.all([
    db.select({ id: schema.dutyScheduleTypes.id, name: schema.dutyScheduleTypes.name }).from(schema.dutyScheduleTypes)
      .where(and(eq(schema.dutyScheduleTypes.tenantId, context.tenantId), eq(schema.dutyScheduleTypes.status, "active")))
      .orderBy(asc(schema.dutyScheduleTypes.name)),
    supervisorIds.length && context.role !== "supervisor"
      ? db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, supervisorIds)).orderBy(asc(schema.user.name))
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);
  return {
    role: context.role,
    brokers: brokers.map((broker) => ({ id: broker.id, name: broker.name, branchName: broker.branchName })),
    branches: [...branchMap].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    dutyTypes: types,
    supervisors,
  };
}
export type AudienceOptions = Awaited<ReturnType<typeof getAudienceOptions>>;

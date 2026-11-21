import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";

import { upcomingShift } from "@/features/dashboard/welcome-rules";
import { getPublishedDutyScheduleIds, getSaoPauloDateKey, selectEffectiveDutyAssignments } from "@/features/lead-distribution/dated-duty-roster";
import {
  addBrokerToPublishedOccurrenceAction,
  getMonthlyDutyPlanAction,
  removeBrokerFromPublishedOccurrenceAction,
  updateMonthlyDutyDraftAction,
} from "@/features/lead-distribution/monthly-duty-actions";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import type { AgentActionRecord, AgentBackend, DutyNow } from "./backend";
import type { Person, SeatOccurrence } from "./types";

/**
 * O backend real: cada método usa a consulta ou a ação que a tela já usa. As ações chamam
 * `getRequiredTenantContext()` sozinhas (mesma requisição da rota, mesmo cookie) e conferem permissão de novo.
 */
const NOT_PUBLISHED = "não está na escala publicada";

function monthKeysBetween(from: string, until: string) {
  const keys: string[] = [];
  // O mês anterior também: uma escala pode avançar no começo do mês seguinte.
  let cursor = new Date(Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 2, 1));
  const last = until.slice(0, 7);
  while (cursor.toISOString().slice(0, 7) <= last && keys.length < 6) {
    keys.push(cursor.toISOString().slice(0, 7));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return keys;
}

export function createServerAgentBackend(context: TenantContext): AgentBackend {
  const db = getDatabase();

  return {
    now: () => new Date(),

    async listPeople(): Promise<Person[]> {
      const rows = await db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          role: schema.tenantMemberships.role,
          jobTitle: schema.tenantMemberships.jobTitle,
          status: schema.tenantMemberships.status,
          availability: schema.tenantMemberships.availabilityStatus,
          branchId: schema.tenantMemberships.branchId,
          branchName: schema.branches.name,
        })
        .from(schema.tenantMemberships)
        .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
        .leftJoin(schema.branches, and(eq(schema.branches.id, schema.tenantMemberships.branchId), eq(schema.branches.tenantId, context.tenantId)))
        .where(eq(schema.tenantMemberships.tenantId, context.tenantId))
        .limit(2000);
      return rows.map((row) => ({ ...row, name: row.name?.trim() || "Sem nome", status: String(row.status), availability: String(row.availability) }));
    },

    async listSeats({ from, until }) {
      const [views, types] = await Promise.all([
        Promise.all(monthKeysBetween(from, until).map((key) => getMonthlyDutyPlanAction(key).catch(() => null))),
        db.select({ id: schema.dutyScheduleTypes.id, name: schema.dutyScheduleTypes.name }).from(schema.dutyScheduleTypes).where(eq(schema.dutyScheduleTypes.tenantId, context.tenantId)),
      ]);
      const typeName = new Map(types.map((row) => [row.id, row.name]));
      const byId = new Map<string, SeatOccurrence>();
      for (const view of views) {
        if (!view) continue;
        const live = new Set(view.publishedOccurrenceIds);
        for (const occurrence of view.occurrences) {
          if (occurrence.dutyDate < from || occurrence.dutyDate > until) continue;
          const source = view.status === "published" || live.has(occurrence.id) ? "published" : "draft";
          const seat: SeatOccurrence = {
            id: occurrence.id,
            scheduleId: occurrence.scheduleId,
            scheduleName: occurrence.scheduleName,
            dutyDate: occurrence.dutyDate,
            startsAt: occurrence.startsAt,
            endsAt: occurrence.endsAt,
            typeId: occurrence.typeId ?? null,
            typeName: occurrence.typeId ? typeName.get(occurrence.typeId) ?? null : null,
            attendanceMode: occurrence.attendanceMode ?? null,
            maximumBrokers: occurrence.maximumBrokers,
            minimumBrokers: occurrence.minimumBrokers,
            brokerIds: occurrence.brokers.map((broker) => broker.id),
            allowedBrokerIds: occurrence.allowedBrokerIds,
            started: occurrence.started,
            ended: occurrence.ended,
            source,
            planId: view.id,
          };
          const previous = byId.get(seat.id);
          if (!previous || (previous.source === "draft" && seat.source === "published")) byId.set(seat.id, seat);
        }
      }
      return [...byId.values()];
    },

    async dutyNow(): Promise<DutyNow[]> {
      const now = new Date();
      const schedules = await db
        .select({
          id: schema.unitDutySchedules.id,
          name: schema.unitDutySchedules.name,
          dayOfWeek: schema.unitDutySchedules.dayOfWeek,
          startsAt: schema.unitDutySchedules.startsAt,
          endsAt: schema.unitDutySchedules.endsAt,
          timezone: schema.unitDutySchedules.timezone,
          validFrom: schema.unitDutySchedules.validFrom,
          validUntil: schema.unitDutySchedules.validUntil,
          minimumBrokers: schema.unitDutySchedules.minimumBrokers,
          queueName: schema.leadQueues.name,
        })
        .from(schema.unitDutySchedules)
        .leftJoin(schema.leadQueues, eq(schema.leadQueues.id, schema.unitDutySchedules.queueId))
        .where(and(
          eq(schema.unitDutySchedules.tenantId, context.tenantId),
          eq(schema.unitDutySchedules.status, "active"),
          or(isNull(schema.unitDutySchedules.validUntil), gt(schema.unitDutySchedules.validUntil, now)),
        ));
      const running = schedules.flatMap((schedule) => {
        const shift = upcomingShift(schedule, now);
        return shift?.running ? [{ schedule, shift }] : [];
      });
      if (!running.length) return [];
      const ids = running.map((item) => item.schedule.id);
      const dates = [...new Set(running.map((item) => item.shift.dutyDate))];
      const today = getSaoPauloDateKey(now);
      const [assignments, published, presence] = await Promise.all([
        db.select({
          scheduleId: schema.dutyRosterAssignments.scheduleId,
          brokerId: schema.dutyRosterAssignments.brokerId,
          dutyDate: schema.dutyRosterAssignments.dutyDate,
          pausedAt: schema.dutyRosterAssignments.pausedAt,
        })
          .from(schema.dutyRosterAssignments)
          .where(and(eq(schema.dutyRosterAssignments.tenantId, context.tenantId), eq(schema.dutyRosterAssignments.status, "active"), inArray(schema.dutyRosterAssignments.scheduleId, ids))),
        getPublishedDutyScheduleIds(context.tenantId, today),
        db.select({ scheduleId: schema.dutyPresenceConfirmations.scheduleId, brokerId: schema.dutyPresenceConfirmations.brokerId, status: schema.dutyPresenceConfirmations.status })
          .from(schema.dutyPresenceConfirmations)
          .where(and(eq(schema.dutyPresenceConfirmations.tenantId, context.tenantId), inArray(schema.dutyPresenceConfirmations.scheduleId, ids), inArray(schema.dutyPresenceConfirmations.dutyDate, dates))),
      ]);
      const brokerIds = [...new Set(assignments.map((row) => row.brokerId))];
      const people = brokerIds.length
        ? await db.select({ id: schema.user.id, name: schema.user.name, availability: schema.tenantMemberships.availabilityStatus })
          .from(schema.user)
          .innerJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.user.id), eq(schema.tenantMemberships.tenantId, context.tenantId)))
          .where(inArray(schema.user.id, brokerIds))
        : [];
      const person = new Map(people.map((row) => [row.id, row]));
      const rank = { confirmed: 4, absent: 3, pending: 2, expired: 1 } as Record<string, number>;
      const presenceOf = new Map<string, DutyNow["brokers"][number]["presence"]>();
      for (const row of presence) {
        const key = `${row.scheduleId}|${row.brokerId}`;
        const current = presenceOf.get(key);
        if (!current || (rank[row.status] ?? 0) > (rank[current] ?? 0)) presenceOf.set(key, row.status as DutyNow["brokers"][number]["presence"]);
      }
      return running.map(({ schedule, shift }) => {
        const rows = selectEffectiveDutyAssignments(assignments.filter((row) => row.scheduleId === schedule.id), shift.dutyDate, published);
        const seen = new Set<string>();
        const brokers = rows.flatMap((row) => {
          if (seen.has(row.brokerId)) return [];
          seen.add(row.brokerId);
          const who = person.get(row.brokerId);
          return [{
            id: row.brokerId,
            name: who?.name?.trim() || "Corretor",
            presence: presenceOf.get(`${schedule.id}|${row.brokerId}`) ?? "none",
            pausedHere: Boolean(row.pausedAt),
            pausedGlobal: who?.availability === "paused",
          }];
        }).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        return {
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          dutyDate: shift.dutyDate,
          startsAt: schedule.startsAt,
          endsAt: schedule.endsAt,
          minimumBrokers: schedule.minimumBrokers,
          queueName: schedule.queueName,
          brokers,
        };
      }).sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.scheduleName.localeCompare(b.scheduleName, "pt-BR"));
    },

    async addSeat(occurrence, brokerId, force) {
      try {
        await addBrokerToPublishedOccurrenceAction({ occurrenceId: occurrence.id, brokerId, force: force || undefined });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (occurrence.source !== "draft" || !message.includes(NOT_PUBLISHED)) throw error;
        await updateMonthlyDutyDraftAction({ planId: occurrence.planId, occurrenceId: occurrence.id, brokerId, operation: "add", force: force || undefined });
      }
    },

    async removeSeat(occurrence, brokerId) {
      try {
        await removeBrokerFromPublishedOccurrenceAction({ occurrenceId: occurrence.id, brokerId });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (occurrence.source !== "draft" || !message.includes(NOT_PUBLISHED)) throw error;
        await updateMonthlyDutyDraftAction({ planId: occurrence.planId, occurrenceId: occurrence.id, brokerId, operation: "remove" });
      }
    },

    async record(entry: AgentActionRecord) {
      const id = randomUUID();
      const now = new Date();
      try {
        const [row] = await db.insert(schema.agentActions).values({
          id,
          tenantId: context.tenantId,
          userId: context.userId,
          toolCallId: entry.toolCallId,
          tool: entry.tool,
          requestText: entry.requestText,
          input: entry.input,
          approval: entry.approval,
          status: entry.status,
          message: entry.message.slice(0, 2000),
          undo: entry.undo,
          durationMs: entry.durationMs,
          createdAt: now,
          updatedAt: now,
        }).onConflictDoNothing().returning({ id: schema.agentActions.id });
        return row?.id ?? null;
      } catch (error) {
        console.warn("[agent] trilha não gravada", { tool: entry.tool, message: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
        return null;
      }
    },

    async recorded(toolCallId) {
      try {
        const [row] = await db.select({ id: schema.agentActions.id, message: schema.agentActions.message, status: schema.agentActions.status })
          .from(schema.agentActions)
          .where(and(eq(schema.agentActions.userId, context.userId), eq(schema.agentActions.toolCallId, toolCallId)))
          .limit(1);
        return row ?? null;
      } catch {
        return null;
      }
    },
  };
}

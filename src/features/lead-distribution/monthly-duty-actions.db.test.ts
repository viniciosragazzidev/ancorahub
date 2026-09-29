/**
 * End-to-end check of the monthly duty flow against a real database, fully
 * inside one transaction that is ROLLED BACK at the end: nothing is committed.
 * Opt-in only (never part of the normal suite):
 *   RUN_DUTY_DB_E2E=1 npx vitest run src/features/lead-distribution/monthly-duty-actions.db.test.ts
 */
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { existsSync, readFileSync } from "node:fs";
import { afterAll, describe, expect, it, vi } from "vitest";

import * as realSchema from "@/shared/db/schema";
import type { TenantContext } from "@/shared/auth/types";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// No side effects outside the rolled-back transaction.
vi.mock("./jobs", () => ({ wakeLeadsAwaitingEligibleBroker: vi.fn().mockResolvedValue(0) }));
vi.mock("./duty-presence", () => ({ sendDutyPresenceInviteManually: vi.fn() }));

const state: { tx: unknown; context: TenantContext | null } = { tx: null, context: null };
vi.mock("@/shared/db", () => ({ schema: realSchema, getDatabase: () => state.tx }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("@/features/system-settings/queries", async () => ({
  FEATURE_FLAGS: (await vi.importActual<typeof import("@/shared/feature-flags/catalog")>("@/shared/feature-flags/catalog")).FEATURE_FLAGS,
  getFeatureFlag: async () => "true",
}));

const enabled = process.env.RUN_DUTY_DB_E2E === "1";
// @next/env skips .env.local under NODE_ENV=test, so read it directly.
function readLocalEnv(name: string) {
  if (!existsSync(".env.local")) return "";
  const line = readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}
const url = enabled ? (readLocalEnv("SUPABASE_DB_URL") || readLocalEnv("DATABASE_URL")) : "";
const client = enabled ? postgres(url, { prepare: false, max: 1 }) : null;
const db = client ? drizzle(client, { schema: realSchema }) : null;

afterAll(async () => { await client?.end({ timeout: 5 }); });

class Rollback extends Error {}

describe.skipIf(!enabled)("monthly duty flow on the real schema (rolled back)", () => {
  it("generates, edits and publishes without touching the weekly roster, then rolls back", async () => {
    const s = realSchema;
    const report: Record<string, unknown> = {};
    await db!.transaction(async (tx) => {
      state.tx = tx;
      // A tenant with a director, active brokers and at least one active plantão.
      const [director] = await tx.select({ userId: s.tenantMemberships.userId, tenantId: s.tenantMemberships.tenantId })
        .from(s.tenantMemberships)
        .innerJoin(s.unitDutySchedules, and(eq(s.unitDutySchedules.tenantId, s.tenantMemberships.tenantId), eq(s.unitDutySchedules.status, "active")))
        .where(and(eq(s.tenantMemberships.role, "director"), eq(s.tenantMemberships.status, "active")))
        .limit(1);
      expect(director, "needs a tenant with a director and an active plantão").toBeTruthy();
      state.context = { userId: director.userId, tenantId: director.tenantId, role: "director", jobTitle: "director", branchId: null };

      const actions = await import("./monthly-duty-actions");
      const { getPublishedDutyScheduleIds, selectEffectiveDutyAssignments } = await import("./dated-duty-roster");
      const monthKey = "2031-03"; // far future: no real plan exists, reminders never look there
      // Own weekly plantão (rolled back with the rest): the scenario must not
      // depend on which real plantões happen to reach March 2031.
      const duty = await import("./duty-actions");
      const weekly = new FormData();
      weekly.set("name", "E2E plantão semanal");
      weekly.set("daysOfWeek", "[6]");
      weekly.set("startsAt", "09:00");
      weekly.set("endsAt", "13:00");
      weekly.set("minimumBrokers", "1");
      weekly.set("validFrom", "2031-01-01");
      expect((await duty.createDutyScheduleAction({}, weekly)).error).toBeUndefined();

      // A plantão whose only date already passed is never staffed.
      const past = new FormData();
      past.set("name", "E2E plantão encerrado");
      past.set("dates", JSON.stringify(["2026-09-23"]));
      past.set("daysOfWeek", "[3]");
      past.set("validFrom", "2026-09-23");
      past.set("startsAt", "05:00");
      past.set("endsAt", "06:00");
      past.set("minimumBrokers", "1");
      const pastCreated = await duty.createDutyScheduleAction({}, past);
      expect(pastCreated.error).toBeUndefined();
      await expect(actions.generateMonthlyDutyPlanAction({ monthKey: "2026-09", quotas: [], scheduleIds: [pastCreated.scheduleId!] }))
        .rejects.toThrow(/ainda vá acontecer/);

      const weeklyBefore = await tx.select({ n: sql<number>`count(*)::int` }).from(s.dutyRosterAssignments).where(and(eq(s.dutyRosterAssignments.tenantId, director.tenantId), isNull(s.dutyRosterAssignments.dutyDate)));

      // Quotas: 2 per active broker.
      const brokers = await tx.select({ id: s.tenantMemberships.userId }).from(s.tenantMemberships)
        .where(and(eq(s.tenantMemberships.tenantId, director.tenantId), eq(s.tenantMemberships.role, "broker"), eq(s.tenantMemberships.jobTitle, "broker"), eq(s.tenantMemberships.status, "active"), isNotNull(s.tenantMemberships.branchId)));
      const draft = await actions.generateMonthlyDutyPlanAction({ monthKey, quotas: brokers.map((broker) => ({ brokerId: broker.id, quota: 2 })) });
      report.generated = { occurrences: draft.occurrences.length, assigned: draft.totalAssigned, belowMinimum: draft.belowMinimum, problems: draft.problems };
      expect(draft.status).toBe("draft");
      expect(draft.problems).toEqual([]);
      // One occurrence per plantão per date (global plantão is not multiplied by unit).
      expect(new Set(draft.occurrences.map((occurrence) => occurrence.id)).size).toBe(draft.occurrences.length);
      expect(draft.occurrences.every((occurrence) => occurrence.maximumBrokers === null || occurrence.assignedCount <= occurrence.maximumBrokers)).toBe(true);

      // Manual edit: remove then re-add the first allocated broker.
      const target = draft.occurrences.find((occurrence) => occurrence.brokers.length)!;
      const removed = await actions.updateMonthlyDutyDraftAction({ planId: draft.id, occurrenceId: target.id, brokerId: target.brokers[0].id, operation: "remove" });
      expect(removed.totalAssigned).toBe(draft.totalAssigned - 1);
      const readded = await actions.updateMonthlyDutyDraftAction({ planId: draft.id, occurrenceId: target.id, brokerId: target.brokers[0].id, operation: "add" });
      expect(readded.totalAssigned).toBe(draft.totalAssigned);
      await expect(actions.updateMonthlyDutyDraftAction({ planId: draft.id, occurrenceId: target.id, brokerId: target.brokers[0].id, operation: "add" })).rejects.toThrow();

      // Publish.
      const published = await actions.publishMonthlyDutyPlanAction(draft.id);
      expect(published.status).toBe("published");
      const dated = await tx.select({ id: s.dutyRosterAssignments.id, scheduleId: s.dutyRosterAssignments.scheduleId, dutyDate: s.dutyRosterAssignments.dutyDate, validFrom: s.dutyRosterAssignments.validFrom, validUntil: s.dutyRosterAssignments.validUntil })
        .from(s.dutyRosterAssignments).where(eq(s.dutyRosterAssignments.monthlyPlanId, draft.id));
      report.publishedRows = dated.length;
      expect(dated.length).toBe(draft.totalAssigned);
      expect(dated.every((row) => row.dutyDate?.startsWith(monthKey) && row.validUntil!.getTime() - row.validFrom.getTime() === 24 * 3600_000)).toBe(true);

      // Weekly roster untouched and still what the weekly screens read.
      const weeklyAfter = await tx.select({ n: sql<number>`count(*)::int` }).from(s.dutyRosterAssignments).where(and(eq(s.dutyRosterAssignments.tenantId, director.tenantId), isNull(s.dutyRosterAssignments.dutyDate)));
      expect(weeklyAfter[0].n).toBe(weeklyBefore[0].n);

      // Runtime: on a published date the plantão uses the published brokers.
      const day = dated[0].dutyDate!;
      const publishedIds = await getPublishedDutyScheduleIds(director.tenantId, day);
      expect(publishedIds?.has(dated[0].scheduleId)).toBe(true);
      const rows = await tx.select({ id: s.dutyRosterAssignments.id, scheduleId: s.dutyRosterAssignments.scheduleId, dutyDate: s.dutyRosterAssignments.dutyDate })
        .from(s.dutyRosterAssignments).where(and(eq(s.dutyRosterAssignments.tenantId, director.tenantId), eq(s.dutyRosterAssignments.scheduleId, dated[0].scheduleId), eq(s.dutyRosterAssignments.status, "active")));
      const effective = selectEffectiveDutyAssignments(rows, day, publishedIds);
      expect(effective.every((row) => row.dutyDate === day)).toBe(true);
      expect(selectEffectiveDutyAssignments(rows, day, null).every((row) => row.dutyDate === null)).toBe(true);

      // The same draft is not published twice.
      await expect(actions.publishMonthlyDutyPlanAction(draft.id)).rejects.toThrow();

      // The month is staffed again: the new revision replaces every date still
      // ahead (all of March 2031 here) and the previous one becomes history.
      const redo = await actions.generateMonthlyDutyPlanAction({ monthKey, quotas: brokers.map((broker) => ({ brokerId: broker.id, quota: 1 })) });
      expect(redo.status).toBe("draft");
      expect(redo.replacesPublished).toBe(true);
      const republished = await actions.publishMonthlyDutyPlanAction(redo.id);
      expect(republished.status).toBe("published");
      const [previousPlan] = await tx.select({ status: s.dutyScheduleMonthlyPlans.status }).from(s.dutyScheduleMonthlyPlans).where(eq(s.dutyScheduleMonthlyPlans.id, draft.id));
      expect(previousPlan.status).toBe("superseded");
      const stillActive = await tx.select({ n: sql<number>`count(*)::int` }).from(s.dutyRosterAssignments)
        .where(and(eq(s.dutyRosterAssignments.monthlyPlanId, draft.id), eq(s.dutyRosterAssignments.status, "active")));
      expect(stillActive[0].n).toBe(0);
      const newRows = await tx.select({ n: sql<number>`count(*)::int` }).from(s.dutyRosterAssignments)
        .where(and(eq(s.dutyRosterAssignments.monthlyPlanId, redo.id), eq(s.dutyRosterAssignments.status, "active")));
      expect(newRows[0].n).toBe(redo.totalAssigned);

      // Managers cannot write.
      state.context = { ...state.context, role: "manager", branchId: "any" };
      await expect(actions.generateMonthlyDutyPlanAction({ monthKey: "2031-04", quotas: [] })).rejects.toThrow(/Apenas o Diretor/);

      tx.rollback();
    }).catch((error) => {
      if (!(error instanceof Rollback) && !String(error?.message ?? error).includes("Rollback")) throw error;
    });
    console.log("[duty-e2e]", JSON.stringify(report));
    // Nothing survived the rollback.
    const leftovers = await db!.select({ n: sql<number>`count(*)::int` }).from(realSchema.dutyScheduleMonthlyPlans).where(eq(realSchema.dutyScheduleMonthlyPlans.monthKey, "2031-03"));
    expect(leftovers[0].n).toBe(0);
  }, 120_000);

  it("keeps manual plantão creation and the weekly roster working next to a published month", async () => {
    const s = realSchema;
    await db!.transaction(async (tx) => {
      state.tx = tx;
      const [director] = await tx.select({ userId: s.tenantMemberships.userId, tenantId: s.tenantMemberships.tenantId })
        .from(s.tenantMemberships)
        .where(and(eq(s.tenantMemberships.role, "director"), eq(s.tenantMemberships.status, "active")))
        .limit(1);
      state.context = { userId: director.userId, tenantId: director.tenantId, role: "director", jobTitle: "director", branchId: null };
      const duty = await import("./duty-actions");
      const roster = await import("./roster-actions");
      const monthly = await import("./monthly-duty-actions");

      // 1. Manual plantão (Tuesday 18–19h, max 2) — the regular form payload. Inside
      //    the brokers' default availability (08:00–19:00), or nobody can be staffed.
      const form = new FormData();
      form.set("name", "E2E plantão manual");
      form.set("daysOfWeek", "[2]");
      form.set("startsAt", "18:00");
      form.set("endsAt", "19:00");
      form.set("minimumBrokers", "1");
      form.set("maximumBrokers", "2");
      form.set("validFrom", "2031-01-01");
      const created = await duty.createDutyScheduleAction({}, form);
      expect(created.error).toBeUndefined();
      const scheduleId = created.scheduleId!;

      // 2. Weekly roster by hand: two fit, the third hits the ceiling.
      const brokers = (await tx.select({ id: s.tenantMemberships.userId }).from(s.tenantMemberships)
        .where(and(eq(s.tenantMemberships.tenantId, director.tenantId), eq(s.tenantMemberships.role, "broker"), eq(s.tenantMemberships.jobTitle, "broker"), eq(s.tenantMemberships.status, "active"), isNotNull(s.tenantMemberships.branchId)))
        .limit(3)).map((row) => row.id);
      expect(brokers.length).toBe(3);
      const assign = (brokerId: string) => {
        const data = new FormData();
        data.set("scheduleId", scheduleId); data.set("brokerId", brokerId); data.set("dayOfWeek", "2"); data.set("startsAt", "18:00"); data.set("endsAt", "19:00");
        return roster.createRosterAssignmentAction({}, data);
      };
      expect(await assign(brokers[0])).toEqual({ success: true });
      expect(await assign(brokers[1])).toEqual({ success: true });
      expect((await assign(brokers[2])).error).toMatch(/máximo/);

      // 3. Publish a month that includes this plantão, with the third broker in it.
      // Only the chosen plantão: its Tuesdays in March 2031, nothing else.
      const draft = await monthly.generateMonthlyDutyPlanAction({ monthKey: "2031-03", quotas: brokers.map((brokerId) => ({ brokerId, quota: 4 })), scheduleIds: [scheduleId] });
      expect(draft.occurrences.every((occurrence) => occurrence.scheduleId === scheduleId)).toBe(true);
      expect(draft.occurrences.map((occurrence) => occurrence.dutyDate)).toEqual(["2031-03-04", "2031-03-11", "2031-03-18", "2031-03-25"]);
      await monthly.publishMonthlyDutyPlanAction(draft.id);
      const datedHere = await tx.select({ brokerId: s.dutyRosterAssignments.brokerId }).from(s.dutyRosterAssignments)
        .where(and(eq(s.dutyRosterAssignments.scheduleId, scheduleId), isNotNull(s.dutyRosterAssignments.dutyDate)));
      expect(datedHere.length).toBeGreaterThan(0);

      // 4. The weekly roster ignores dated rows: no false ceiling, no false overlap.
      const [weeklyFirst] = await tx.select({ id: s.dutyRosterAssignments.id }).from(s.dutyRosterAssignments)
        .where(and(eq(s.dutyRosterAssignments.scheduleId, scheduleId), eq(s.dutyRosterAssignments.brokerId, brokers[0]), isNull(s.dutyRosterAssignments.dutyDate), eq(s.dutyRosterAssignments.status, "active")));
      const removeForm = new FormData();
      removeForm.set("assignmentId", weeklyFirst.id);
      expect(await roster.removeRosterAssignmentAction({}, removeForm)).toEqual({ success: true });
      expect(await assign(brokers[2])).toEqual({ success: true });

      // 5a. Default "Datas" creation: a range becomes one-day plantões with the right weekday.
      const createOn = (dates: string[]) => {
        const data = new FormData();
        data.set("name", "E2E plantão manual");
        data.set("startsAt", "07:00");
        data.set("endsAt", "08:00");
        data.set("minimumBrokers", "1");
        data.set("validFrom", dates[0]);
        data.set("dates", JSON.stringify(dates));
        return duty.createDutyScheduleAction({}, data);
      };
      const createdByDates = await createOn(["2031-05-06", "2031-05-07"]);
      expect(createdByDates.error).toBeUndefined();
      const dated = await tx.select({ dayOfWeek: s.unitDutySchedules.dayOfWeek, validFrom: s.unitDutySchedules.validFrom, validUntil: s.unitDutySchedules.validUntil })
        .from(s.unitDutySchedules).where(inArray(s.unitDutySchedules.id, createdByDates.scheduleIds!));
      expect(dated.map((row) => row.dayOfWeek).sort()).toEqual([2, 3]);
      expect(dated.every((row) => row.validUntil!.getTime() - row.validFrom.getTime() === 24 * 3600_000)).toBe(true);
      // Next Tuesday, same hour: the 06/05 plantão is over, so it no longer blocks (it used to).
      const nextWeek = await createOn(["2031-05-13"]);
      expect(nextWeek.error).toBeUndefined();
      // The same date again really overlaps → refused.
      expect((await createOn(["2031-05-13"])).error).toMatch(/mesmo horário/);

      // 5c. The roster follows the plantão's dates: the same broker fits the 06/05
      //     and the 13/05 plantão (same weekday and hour, different weeks), but not
      //     a plantão that also runs on 13/05 at that hour.
      const assignTo = (targetScheduleId: string, brokerId: string, startsAt: string, endsAt: string) => {
        const data = new FormData();
        data.set("scheduleId", targetScheduleId); data.set("brokerId", brokerId); data.set("dayOfWeek", "2"); data.set("startsAt", startsAt); data.set("endsAt", endsAt);
        return roster.createRosterAssignmentAction({}, data);
      };
      const [tuesdayMay6] = await tx.select({ id: s.unitDutySchedules.id }).from(s.unitDutySchedules)
        .where(and(inArray(s.unitDutySchedules.id, createdByDates.scheduleIds!), eq(s.unitDutySchedules.dayOfWeek, 2)));
      expect(await assignTo(tuesdayMay6.id, brokers[0], "07:00", "08:00")).toEqual({ success: true });
      expect(await assignTo(nextWeek.scheduleIds![0], brokers[0], "07:00", "08:00")).toEqual({ success: true });
      expect((await assignTo(scheduleId, brokers[0], "07:00", "08:00")).error).toMatch(/já está no plantão "E2E plantão manual" das 07:00 às 08:00/);

      // 5b. Changing the receiving queue on edit keeps the Filas page in sync.
      const [queueA, queueB] = await tx.select({ id: s.leadQueues.id }).from(s.leadQueues)
        .where(and(eq(s.leadQueues.tenantId, director.tenantId), eq(s.leadQueues.status, "active"))).limit(2);
      const linkedTo = async () => (await tx.select({ id: s.leadQueues.id, ids: s.leadQueues.exclusiveDutyScheduleIds }).from(s.leadQueues)
        .where(eq(s.leadQueues.tenantId, director.tenantId))).filter((queue) => (queue.ids ?? []).includes(scheduleId)).map((queue) => queue.id);
      const relink = (queueId: string) => {
        const data = new FormData();
        data.set("scheduleId", scheduleId); data.set("name", "E2E plantão manual"); data.set("dayOfWeek", "2"); data.set("startsAt", "18:00"); data.set("endsAt", "19:00");
        data.set("minimumBrokers", "1"); data.set("maximumBrokers", "2"); data.set("validFrom", "2031-01-01"); data.set("receivingQueueId", queueId);
        return duty.updateDutyScheduleAction({}, data);
      };
      expect((await relink(queueA.id)).error).toBeUndefined();
      expect(await linkedTo()).toEqual([queueA.id]);
      expect((await relink(queueB.id)).error).toBeUndefined();
      expect(await linkedTo()).toEqual([queueB.id]);
      expect((await relink("")).error).toBeUndefined();
      expect(await linkedTo()).toEqual([]);

      // 5. Editing the plantão's maximum only looks at the weekly roster.
      const edit = new FormData();
      edit.set("scheduleId", scheduleId); edit.set("name", "E2E plantão manual"); edit.set("dayOfWeek", "2"); edit.set("startsAt", "18:00"); edit.set("endsAt", "19:00");
      edit.set("minimumBrokers", "1"); edit.set("maximumBrokers", "2"); edit.set("validFrom", "2031-01-01"); edit.set("validUntil", "2031-06-30");
      expect((await duty.updateDutyScheduleAction({}, edit)).error).toBeUndefined();

      // 6. Shortening the plantão takes its weekly roster with it.
      const [plantao] = await tx.select({ validUntil: s.unitDutySchedules.validUntil }).from(s.unitDutySchedules).where(eq(s.unitDutySchedules.id, scheduleId));
      const weekly = await tx.select({ validUntil: s.dutyRosterAssignments.validUntil }).from(s.dutyRosterAssignments)
        .where(and(eq(s.dutyRosterAssignments.scheduleId, scheduleId), eq(s.dutyRosterAssignments.status, "active"), isNull(s.dutyRosterAssignments.dutyDate)));
      expect(weekly.length).toBeGreaterThan(0);
      expect(weekly.every((row) => row.validUntil?.getTime() === plantao.validUntil?.getTime())).toBe(true);

      tx.rollback();
    }).catch((error) => {
      if (!String(error?.message ?? error).includes("Rollback")) throw error;
    });
    const leftovers = await db!.select({ n: sql<number>`count(*)::int` }).from(realSchema.unitDutySchedules).where(eq(realSchema.unitDutySchedules.name, "E2E plantão manual"));
    expect(leftovers[0].n).toBe(0);
  }, 120_000);
});

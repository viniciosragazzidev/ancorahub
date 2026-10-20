import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const table = (name: string) => new Proxy({ name }, { get: (target, key) => key === "name" ? target.name : `${target.name}.${String(key)}` });
  const schema = { unitDutySchedules: table("schedules"), dutyRosterAssignments: table("assignments"), auditLogs: table("audit") };
  const scheduleId = "00000000-0000-4000-8000-000000000001";
  const assignmentId = "00000000-0000-4000-8000-000000000002";
  const schedule = { id: scheduleId, tenantId: "tenant-1", branchId: "branch-1", queueId: null, status: "active", attendanceMode: "presencial" };
  const context = { tenantId: "tenant-1", userId: "director-1", role: "director" as string, branchId: null as string | null };
  const writes = { updates: [] as Record<string, unknown>[], inserts: [] as Record<string, unknown>[], updatedRows: [{ id: assignmentId }] as unknown[] };
  const tx = {
    update: vi.fn(() => ({ set: (set: Record<string, unknown>) => ({ where: () => ({ returning: async () => { writes.updates.push(set); return writes.updatedRows; } }) }) })),
    insert: vi.fn(() => ({ values: async (values: Record<string, unknown>) => { writes.inserts.push(values); } })),
  };
  const db = {
    select: vi.fn(() => {
      const query = { from: vi.fn(() => query), where: vi.fn(() => query), limit: vi.fn(async () => [schedule]) };
      return query;
    }),
    transaction: async (callback: (value: typeof tx) => unknown) => callback(tx),
  };
  return { assignmentId, context, db, schedule, scheduleId, schema, writes };
});

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => {
  const expression = (...args: unknown[]) => ({ args });
  return { and: expression, asc: expression, eq: expression, gt: expression, gte: expression, inArray: expression, isNull: expression, lt: expression, ne: expression, notInArray: expression, or: expression, sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) };
});
vi.mock("@/shared/db", () => ({ getDatabase: () => state.db, schema: state.schema }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: () => Promise.resolve(state.context) }));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: vi.fn(async () => "true") }));
vi.mock("./duty-schedule-profile-queries", () => ({}));
vi.mock("./service", () => ({}));
vi.mock("./domain", () => ({}));
vi.mock("./duty-schedule-input", () => ({}));
vi.mock("./duty-shifts", () => ({}));
vi.mock("./monthly-duty-plan", () => ({}));
vi.mock("./duty-presence", () => ({}));
vi.mock("./jobs", () => ({ wakeLeadsAwaitingEligibleBroker: vi.fn(async () => 0) }));
vi.mock("./broker-day-history", () => ({}));

import { wakeLeadsAwaitingEligibleBroker } from "./jobs";
import { setDutyAssignmentAttendanceModeAction } from "./duty-actions";

describe("corretor online num plantão presencial (ação do diretor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.context.role = "director";
    state.context.branchId = null;
    state.schedule.attendanceMode = "presencial";
    state.writes.updates = [];
    state.writes.inserts = [];
    state.writes.updatedRows = [{ id: state.assignmentId }];
  });

  it("marks the broker online, audits it and wakes the waiting leads", async () => {
    await expect(setDutyAssignmentAttendanceModeAction({ scheduleId: state.scheduleId, assignmentId: state.assignmentId, mode: "online" })).resolves.toEqual({ ok: true });
    expect(state.writes.updates).toEqual([expect.objectContaining({ attendanceMode: "online", updatedBy: "director-1" })]);
    expect(state.writes.inserts).toEqual([expect.objectContaining({ entidade: "duty_roster_assignment", entidadeId: state.assignmentId, acao: "duty_roster.attendance_online" })]);
    expect(wakeLeadsAwaitingEligibleBroker).toHaveBeenCalledWith("tenant-1");
  });

  it("clears the override back to the plantão's mode", async () => {
    await expect(setDutyAssignmentAttendanceModeAction({ scheduleId: state.scheduleId, assignmentId: state.assignmentId, mode: null })).resolves.toEqual({ ok: true });
    expect(state.writes.updates).toEqual([expect.objectContaining({ attendanceMode: null })]);
    expect(state.writes.inserts[0]).toMatchObject({ acao: "duty_roster.attendance_follows_schedule" });
  });

  it("refuses a manager, even of the plantão's own unit", async () => {
    state.context.role = "manager";
    state.context.branchId = "branch-1";
    await expect(setDutyAssignmentAttendanceModeAction({ scheduleId: state.scheduleId, assignmentId: state.assignmentId, mode: "online" }))
      .resolves.toEqual({ ok: false, reason: "Apenas o Diretor pode deixar um corretor online no plantão." });
    expect(state.writes.updates).toEqual([]);
  });

  it("refuses a broker", async () => {
    state.context.role = "broker";
    await expect(setDutyAssignmentAttendanceModeAction({ scheduleId: state.scheduleId, assignmentId: state.assignmentId, mode: "online" }))
      .resolves.toEqual({ ok: false, reason: "Sem permissão." });
    expect(state.writes.updates).toEqual([]);
  });

  it("refuses online on a plantão that is already online", async () => {
    state.schedule.attendanceMode = "online";
    await expect(setDutyAssignmentAttendanceModeAction({ scheduleId: state.scheduleId, assignmentId: state.assignmentId, mode: "online" }))
      .resolves.toEqual({ ok: false, reason: "Este plantão já é online: todos confirmam com um toque." });
    expect(state.writes.updates).toEqual([]);
  });

  it("refuses an invalid mode or an assignment outside the plantão", async () => {
    await expect(setDutyAssignmentAttendanceModeAction({ scheduleId: state.scheduleId, assignmentId: state.assignmentId, mode: "presencial" }))
      .resolves.toMatchObject({ ok: false });
    state.writes.updatedRows = [];
    await expect(setDutyAssignmentAttendanceModeAction({ scheduleId: state.scheduleId, assignmentId: state.assignmentId, mode: "online" }))
      .resolves.toEqual({ ok: false, reason: "Escalação não encontrada." });
    expect(state.writes.inserts).toEqual([]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const table = (name: string) => new Proxy({ name }, { get: (target, key) => key === "name" ? target.name : `${target.name}.${String(key)}` });
  const schema = { unitDutySchedules: table("schedules"), leadQueues: table("queues"), leads: table("leads") };
  const scheduleId = "00000000-0000-4000-8000-000000000001";
  const brokerId = "00000000-0000-4000-8000-000000000002";
  const leadId = "00000000-0000-4000-8000-000000000003";
  const schedule = { id: scheduleId, tenantId: "tenant-1", branchId: "branch-1", queueId: null, status: "active" };
  const rows = [{ id: leadId, name: "Lead teste", phone: "5511999999999", queueName: "Fila teste", temperature: "warm", createdAt: new Date("2026-10-01T10:00:00Z") }];
  const context = { tenantId: "tenant-1", userId: "director-1", role: "director" as const, branchId: null };
  let resultRows: unknown[] = [];
  const db = {
    select: vi.fn(() => {
      let selectedTable: unknown;
      const query = {
        from: vi.fn((source: unknown) => { selectedTable = source; return query; }),
        leftJoin: vi.fn(() => query), innerJoin: vi.fn(() => query), where: vi.fn(() => query), orderBy: vi.fn(() => query),
        limit: vi.fn(async () => selectedTable === schema.unitDutySchedules ? [schedule] : resultRows),
      };
      return query;
    }),
  };
  return { brokerId, context, db, leadId, rows, schedule, scheduleId, schema, setResultRows: (rows: unknown[]) => { resultRows = rows; } };
});

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => {
  const expression = (...args: unknown[]) => ({ args });
  return { and: expression, asc: expression, eq: expression, gt: expression, gte: expression, inArray: expression, isNull: expression, lt: expression, ne: expression, or: expression, sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) };
});
vi.mock("@/shared/db", () => ({ getDatabase: () => state.db, schema: state.schema }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: () => Promise.resolve(state.context) }));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: vi.fn(async () => "true") }));
vi.mock("./duty-schedule-profile-queries", () => ({ getDutyScheduleProfile: vi.fn(async () => ({ schedule: state.schedule, linkedQueues: [{ id: "queue-1" }], roster: [{ brokerId: state.brokerId }] })) }));
vi.mock("./service", () => ({ assignLeadToBroker: vi.fn(async () => ({ status: "assigned", leadId: state.leadId, brokerId: state.brokerId, strategy: "manual" })) }));
vi.mock("./domain", () => ({}));
vi.mock("./duty-schedule-input", () => ({}));
vi.mock("./duty-shifts", () => ({}));
vi.mock("./monthly-duty-plan", () => ({}));
vi.mock("./duty-presence", () => ({}));
vi.mock("./jobs", () => ({}));
vi.mock("./broker-day-history", () => ({}));
vi.mock("./duty-presence-domain", () => ({}));

import { assignLeadToBroker } from "./service";
import { getDutyScheduleProfile } from "./duty-schedule-profile-queries";
import { assignDutyLeadToBrokerAction, getDutyAvailableLeadsAction } from "./duty-actions";

describe("duty lead actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.setResultRows(state.rows);
  });

  it("returns leads in the available drawer contract", async () => {
    await expect(getDutyAvailableLeadsAction(state.scheduleId)).resolves.toEqual({ ok: true, leads: [{
      id: state.leadId, name: "Lead teste", phone: "5511999999999", queueName: "Fila teste", temperature: "warm", createdAt: "2026-10-01T10:00:00.000Z",
    }] });
  });

  it("assigns directly to a rostered broker with the selected duty schedule", async () => {
    await expect(assignDutyLeadToBrokerAction(state.scheduleId, state.brokerId, state.leadId)).resolves.toEqual({ ok: true });
    expect(assignLeadToBroker).toHaveBeenCalledWith(state.context, state.leadId, state.brokerId, undefined, "Atribuição manual no plantão", undefined, undefined, {
      skipBrokerWhatsApp: true, requireUnassigned: true, dutyScheduleId: state.scheduleId,
    });
  });

  it("rejects a broker outside the effective schedule roster", async () => {
    await expect(assignDutyLeadToBrokerAction(state.scheduleId, "00000000-0000-4000-8000-000000000099", state.leadId))
      .resolves.toEqual({ ok: false, reason: "Corretor fora da escala." });
    expect(assignLeadToBroker).not.toHaveBeenCalled();
  });

  it.each([
    [{ absent: true }, "Corretor com falta neste plantão."],
    [{ pausedAt: new Date() }, "Corretor pausado neste plantão. Retome antes de atribuir."],
    [{ onSitePending: true }, "Corretor pausado neste plantão. Retome antes de atribuir."],
  ])("never assigns to an absent or paused broker (%o)", async (entry, reason) => {
    vi.mocked(getDutyScheduleProfile).mockResolvedValueOnce({ schedule: state.schedule, linkedQueues: [{ id: "queue-1" }], roster: [{ brokerId: state.brokerId, ...entry }] } as never);
    await expect(assignDutyLeadToBrokerAction(state.scheduleId, state.brokerId, state.leadId)).resolves.toEqual({ ok: false, reason });
    expect(assignLeadToBroker).not.toHaveBeenCalled();
  });
});

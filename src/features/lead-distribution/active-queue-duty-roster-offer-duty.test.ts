import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({ rows: [] as unknown[], select: vi.fn(), resolve: vi.fn(), condition: undefined as unknown }));
vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => ({ select: state.select }) }));
vi.mock("./dated-duty-roster", () => ({
  resolveEffectiveDutyAssignments: state.resolve,
  filterPausedDutyAssignmentsBeforeResolution: (rows: Array<{ pausedAt?: Date | null }>) => rows.filter((row) => !row.pausedAt),
}));

import { isBrokerRunningInDuty } from "./active-queue-duty-roster";

describe("escala exata da oferta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.rows = [{ id: "assignment-a", brokerId: "broker-a", scheduleId: "duty-a", dutyDate: null, pausedAt: null, startsAt: "10:00", branchId: "branch-a" }];
    state.resolve.mockImplementation(async (_tenantId: string, rows: unknown[]) => rows);
    state.select.mockImplementation(() => {
      const query = {
        from: () => query,
        innerJoin: () => query,
        where: (condition: unknown) => { state.condition = condition; return query; },
        then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve(state.rows).then(resolve),
      };
      return query;
    });
  });

  it("compara com a escala efetiva e conserva o filtro de tenant e corretor", async () => {
    const input = { tenantId: "tenant-a", brokerId: "broker-a", dutyScheduleId: "duty-a", now: new Date("2026-11-03T14:00:00Z") };
    await expect(isBrokerRunningInDuty(input)).resolves.toBe(true);
    await expect(isBrokerRunningInDuty({ ...input, dutyScheduleId: "duty-b" })).resolves.toBe(false);
    const where = new PgDialect().sqlToQuery(state.condition as Parameters<PgDialect["sqlToQuery"]>[0]);
    expect(where.params).toEqual(expect.arrayContaining([input.tenantId, input.brokerId, "active"]));
    expect(state.resolve).toHaveBeenCalledWith(input.tenantId, expect.any(Array), input.now);
  });

  it("não aceita uma escala que saiu da vigência efetiva", async () => {
    state.resolve.mockResolvedValue([]);
    await expect(isBrokerRunningInDuty({ tenantId: "tenant-a", brokerId: "broker-a", dutyScheduleId: "duty-a" })).resolves.toBe(false);
  });

  it("ignora a escala pausada antes de resolver a ocorrência efetiva", async () => {
    state.rows = [{ id: "assignment-a", brokerId: "broker-a", scheduleId: "duty-a", dutyDate: null, pausedAt: new Date(), startsAt: "10:00", branchId: "branch-a" }];
    await expect(isBrokerRunningInDuty({ tenantId: "tenant-a", brokerId: "broker-a", dutyScheduleId: "duty-a" })).resolves.toBe(false);
    expect(state.resolve).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ getDatabase: vi.fn(), schema: {} }));

import { pickBrokerRunningDutyScheduleId } from "./active-queue-duty-roster";

describe("pickBrokerRunningDutyScheduleId (envio manual conta no plantão do corretor, 21/10)", () => {
  it("returns null when the broker is not on a running plantão", () => {
    expect(pickBrokerRunningDutyScheduleId([])).toBeNull();
  });
  it("returns the only running plantão", () => {
    expect(pickBrokerRunningDutyScheduleId([{ scheduleId: "premium", startsAt: "09:00" }])).toBe("premium");
  });
  it("picks the plantão that started first, deterministically", () => {
    expect(pickBrokerRunningDutyScheduleId([
      { scheduleId: "tarde", startsAt: "13:30" },
      { scheduleId: "b-manha", startsAt: "09:00" },
      { scheduleId: "a-manha", startsAt: "09:00" },
    ])).toBe("a-manha");
  });
  it("prefers the plantão of the lead's unit over one that started earlier in another unit", () => {
    const rows = [
      { scheduleId: "manha-a", startsAt: "08:00", branchId: "unidade-a" },
      { scheduleId: "tarde-b", startsAt: "10:00", branchId: "unidade-b" },
    ];
    expect(pickBrokerRunningDutyScheduleId(rows, "unidade-b")).toBe("tarde-b");
    expect(pickBrokerRunningDutyScheduleId(rows, "unidade-a")).toBe("manha-a");
  });
  it("prefers a global plantão (no unit) over a plantão of another unit", () => {
    expect(pickBrokerRunningDutyScheduleId([
      { scheduleId: "outra", startsAt: "08:00", branchId: "unidade-a" },
      { scheduleId: "global", startsAt: "10:00", branchId: null },
    ], "unidade-b")).toBe("global");
  });
  it("without the lead's unit keeps the earliest start", () => {
    expect(pickBrokerRunningDutyScheduleId([
      { scheduleId: "tarde-b", startsAt: "10:00", branchId: "unidade-b" },
      { scheduleId: "manha-a", startsAt: "08:00", branchId: "unidade-a" },
    ])).toBe("manha-a");
  });
});

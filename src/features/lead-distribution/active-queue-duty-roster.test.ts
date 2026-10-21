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
});

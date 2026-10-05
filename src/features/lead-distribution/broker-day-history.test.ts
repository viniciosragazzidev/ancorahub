import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ getDatabase: vi.fn(), schema: {} }));
vi.mock("@/features/leads/meta-lead-display", () => ({ readMetaLeadDisplayDetails: vi.fn() }));

import { operationDayOf, operationDayStart } from "./broker-day-history";

// America/Sao_Paulo is UTC-3: 19:00 SP = 22:00 UTC.
describe("operationDayStart", () => {
  it("on Monday before 19:00, starts at Friday 19:00 (the weekend belongs to Monday)", () => {
    expect(operationDayStart(new Date("2026-10-05T14:00:00.000Z"))).toEqual(new Date("2026-10-02T22:00:00.000Z"));
  });

  it("on Monday after 19:00, the next day starts at Monday 19:00", () => {
    expect(operationDayStart(new Date("2026-10-05T23:00:00.000Z"))).toEqual(new Date("2026-10-05T22:00:00.000Z"));
  });

  it("on Tuesday before 19:00, keeps 19:00 of the day before", () => {
    expect(operationDayStart(new Date("2026-10-06T14:00:00.000Z"))).toEqual(new Date("2026-10-05T22:00:00.000Z"));
  });
});

describe("operationDayOf", () => {
  it("a past Monday plantão spans Friday 19:00 to Monday 19:00", () => {
    expect(operationDayOf("2026-10-05")).toEqual({ since: new Date("2026-10-02T22:00:00.000Z"), until: new Date("2026-10-05T22:00:00.000Z") });
  });

  it("a past Wednesday plantão spans Tuesday 19:00 to Wednesday 19:00", () => {
    expect(operationDayOf("2026-10-07")).toEqual({ since: new Date("2026-10-06T22:00:00.000Z"), until: new Date("2026-10-07T22:00:00.000Z") });
  });
});

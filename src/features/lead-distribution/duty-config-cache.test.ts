import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/db", () => ({ getDatabase: vi.fn(), schema: {} }));

import { selectSchedulesRunningAt } from "./service";

const day = (iso: string) => new Date(iso);
const schedule = (startsAt: string, endsAt: string, validFrom = day("2026-01-01T00:00:00Z"), validUntil: Date | null = null) => ({ startsAt, endsAt, validFrom, validUntil });

describe("selectSchedulesRunningAt (same rule the SQL applied before the cache)", () => {
  const now = day("2026-11-15T12:00:00Z");

  it("keeps a plantão that started and has not ended", () => {
    expect(selectSchedulesRunningAt([schedule("08:00", "18:00")], "09:00", now)).toHaveLength(1);
    expect(selectSchedulesRunningAt([schedule("09:00", "18:00")], "09:00", now)).toHaveLength(1);
  });

  it("drops one not started yet or already over (end is exclusive)", () => {
    expect(selectSchedulesRunningAt([schedule("09:01", "18:00")], "09:00", now)).toHaveLength(0);
    expect(selectSchedulesRunningAt([schedule("08:00", "09:00")], "09:00", now)).toHaveLength(0);
  });

  it("respects the validity window", () => {
    expect(selectSchedulesRunningAt([schedule("08:00", "18:00", day("2026-11-16T00:00:00Z"))], "09:00", now)).toHaveLength(0);
    expect(selectSchedulesRunningAt([schedule("08:00", "18:00", day("2026-01-01T00:00:00Z"), day("2026-11-15T12:00:00Z"))], "09:00", now)).toHaveLength(0);
    expect(selectSchedulesRunningAt([schedule("08:00", "18:00", day("2026-01-01T00:00:00Z"), day("2026-11-15T12:00:01Z"))], "09:00", now)).toHaveLength(1);
  });
});

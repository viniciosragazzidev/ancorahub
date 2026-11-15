import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/db", () => ({ getDatabase: vi.fn(), schema: {} }));

import { createDutyConfigCache, DUTY_CONFIG_TTL_MS } from "./duty-config-cache";
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

describe("createDutyConfigCache (runs with the cache on, as in production)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  function onCache() {
    vi.stubEnv("NODE_ENV", "production");
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-15T12:00:00Z") });
    return createDutyConfigCache<string[]>();
  }

  it("loads once per key while the TTL lasts, and concurrent callers share the load", async () => {
    const cache = onCache();
    const load = vi.fn(async () => ["a"]);
    await Promise.all([cache.get("t|2026-11-15", load), cache.get("t|2026-11-15", load)]);
    await cache.get("t|2026-11-15", load);
    expect(load).toHaveBeenCalledTimes(1);
    await cache.get("t|2026-11-16", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("reads again once the TTL is over", async () => {
    const cache = onCache();
    const load = vi.fn(async () => ["a"]);
    await cache.get("k", load);
    vi.setSystemTime(Date.now() + DUTY_CONFIG_TTL_MS - 1);
    await cache.get("k", load);
    expect(load).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 2);
    await cache.get("k", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("never keeps a failed read", async () => {
    const cache = onCache();
    const load = vi.fn().mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce(["b"]);
    await expect(cache.get("k", load)).rejects.toThrow("db down");
    await expect(cache.get("k", load)).resolves.toEqual(["b"]);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

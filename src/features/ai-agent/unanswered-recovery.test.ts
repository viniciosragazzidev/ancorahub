import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const database = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ getDatabase: () => database }));

import { runUnansweredInboundRecovery } from "./unanswered-recovery";

describe("unanswered recovery job", () => {
  beforeEach(() => {
    database.execute.mockReset();
    database.execute.mockResolvedValue([]);
  });

  it("does not query or start a candidate without worst-case turn budget", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-11-05T12:00:00Z");
    vi.setSystemTime(now);
    try {
      const result = await runUnansweredInboundRecovery({ now, deadlineAt: Date.now() + 39_999 });

      expect(result).toEqual({ candidates: 0, answered: 0 });
      expect(database.execute).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("queries only pending non-manual-hold leads within the tenant timeout window", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-11-05T12:00:00Z");
    vi.setSystemTime(now);
    try {
      await runUnansweredInboundRecovery({ now });

      const query = new PgDialect().sqlToQuery(database.execute.mock.calls[0]![0]);
      expect(query.sql).toContain("l.qualification_status in ('pending', 'qualifying')");
      expect(query.sql).toContain("coalesce(l.distribution_status, '') <> 'manual_hold'");
      expect(query.sql).toContain("cfg.timeout_minutes");
      expect(query.sql).toContain("least(30, greatest(1, coalesce(cfg.timeout_minutes, 15)) - 1)");
    } finally {
      vi.useRealTimers();
    }
  });
});

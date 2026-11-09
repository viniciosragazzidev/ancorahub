import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "@/shared/db/schema";
import { LEAD_TIMEOUT_CODE, plantaoWakeAllowedCondition, plantaoWakeKeepsTimeoutPause } from "./job-budget";

const now = new Date("2026-11-09T17:47:11.000Z");
const later = new Date("2026-11-09T17:51:00.000Z");

describe("distribution job budget: plantão wake-up", () => {
  it("keeps the 5-minute pause of a lead that hit the per-lead ceiling", () => {
    expect(plantaoWakeKeepsTimeoutPause({ lastErrorCode: LEAD_TIMEOUT_CODE, runAfter: later }, now)).toBe(true);
  });

  it("still wakes everything else, and a timed-out lead once its pause is over", () => {
    expect(plantaoWakeKeepsTimeoutPause({ lastErrorCode: LEAD_TIMEOUT_CODE, runAfter: now }, now)).toBe(false);
    expect(plantaoWakeKeepsTimeoutPause({ lastErrorCode: "AWAITING_ELIGIBILITY", runAfter: later }, now)).toBe(false);
    expect(plantaoWakeKeepsTimeoutPause({ lastErrorCode: "LEASE_EXPIRED", runAfter: later }, now)).toBe(false);
    expect(plantaoWakeKeepsTimeoutPause({ lastErrorCode: null, runAfter: later }, now)).toBe(false);
  });

  it("renders the same rule in the wake-up query", () => {
    const query = new PgDialect().sqlToQuery(plantaoWakeAllowedCondition(schema.leadDistributionJobs.lastErrorCode, schema.leadDistributionJobs.runAfter, now)!);
    expect(query.sql).toBe('("lead_distribution_jobs"."last_error_code" is null or "lead_distribution_jobs"."last_error_code" <> $1 or "lead_distribution_jobs"."run_after" <= $2)');
    expect(query.params[0]).toBe(LEAD_TIMEOUT_CODE);
  });
});

import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "@/shared/db/schema";
import { sql } from "drizzle-orm";

import { BUDGET_RELEASED_CODE, LEAD_TIMEOUT_CODE, distributionClaimRankSql, distributionWaveRank, plantaoWakeAllowedCondition, plantaoWakeKeepsTimeoutPause } from "./job-budget";
import { groupByTemperatureRank } from "./temperature-priority";

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

describe("distribution job budget: jobs handed back untouched", () => {
  it("puts a cold job handed back by the budget in the first wave of the next run", () => {
    const jobs = [
      { id: "hot", rank: 0 as const, lastErrorCode: null },
      { id: "warm", rank: 1 as const, lastErrorCode: "AWAITING_ELIGIBILITY" },
      { id: "cold-starved", rank: 2 as const, lastErrorCode: BUDGET_RELEASED_CODE },
      { id: "cold", rank: 2 as const, lastErrorCode: null },
    ];
    const waves = groupByTemperatureRank(jobs, (job) => distributionWaveRank(job.rank, job.lastErrorCode)).map((wave) => wave.map((job) => job.id));
    expect(waves).toEqual([["hot", "cold-starved"], ["warm"], ["cold"]]);
  });

  it("keeps the temperature order for every other job", () => {
    expect(distributionWaveRank(2, null)).toBe(2);
    expect(distributionWaveRank(1, LEAD_TIMEOUT_CODE)).toBe(1);
    expect(distributionWaveRank(0, BUDGET_RELEASED_CODE)).toBe(0);
  });

  it("claims a job handed back by the budget as if it were hot", () => {
    const query = new PgDialect().sqlToQuery(distributionClaimRankSql(sql<number>`2`, schema.leadDistributionJobs.lastErrorCode));
    expect(query.sql).toBe('case when "lead_distribution_jobs"."last_error_code" = $1 then 0 else 2 end');
    expect(query.params).toEqual([BUDGET_RELEASED_CODE]);
  });
});

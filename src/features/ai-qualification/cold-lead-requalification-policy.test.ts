import { describe, expect, it, vi } from "vitest";
import { operationDayStart } from "@/features/reports/metrics/lead-quality-period";
import {
  automaticRequalificationDue,
  coldSinceAt,
  countRequalificationAttempts,
  isRequalificationInCooldown,
  isEligibleColdLeadForManualRequalification,
  isWithinRequalificationBusinessWindow,
  nextRequalificationBusinessWindowAt,
  partitionColdLeadsByResponse,
  requalificationSendDecision,
  runWithRequalificationLock,
  selectColdLeadsForOperationDay,
} from "./cold-lead-requalification-policy";
import { defaultColdLeadRequalificationPolicy } from "@/features/lead-distribution/domain";

describe("cold lead requalification policy", () => {
  it("selects only cold unassigned leads created in the operation day", () => {
    const now = new Date("2026-10-15T20:00:00.000Z");
    const since = operationDayStart(now);
    const lead = (id: string, overrides = {}) => ({
      id,
      createdAt: new Date(since.getTime() + 1_000),
      qualificationStatus: "cold",
      qualificationState: "COMPLETED",
      qualificationCompletedAt: new Date(since.getTime()),
      corretorId: null,
      status: "new",
      distributionStatus: "queued",
      distributionRemovedAt: null,
      archivedAt: null,
      deletedAt: null,
      queueId: "queue-1",
      ...overrides,
    });
    expect(selectColdLeadsForOperationDay([
      lead("today"),
      lead("timeout-held", { distributionStatus: "manual_hold", qualificationState: "PARTIAL", qualificationCompletedAt: null }),
      lead("old", { createdAt: new Date(since.getTime() - 1) }),
      lead("warm", { qualificationStatus: "warm" }),
      lead("owned", { corretorId: "broker" }),
      lead("other-manual-hold", { distributionStatus: "manual_hold" }),
    ], since).map((item) => item.id)).toEqual(["today", "timeout-held"]);
    expect(isEligibleColdLeadForManualRequalification(lead("timeout-held", {
      distributionStatus: "manual_hold",
      qualificationState: "PARTIAL",
      qualificationCompletedAt: null,
    }))).toBe(true);
    expect(isEligibleColdLeadForManualRequalification(lead("other-manual-hold", { distributionStatus: "manual_hold" }))).toBe(false);
  });

  it("separates no-response leads from replied leads that stayed cold", () => {
    const leads = [
      { id: "quiet", createdAt: new Date("2026-10-15T10:00:00Z") },
      { id: "replied", createdAt: new Date("2026-10-15T10:00:00Z") },
    ];
    const result = partitionColdLeadsByResponse(leads, new Map([["replied", new Date("2026-10-15T10:01:00Z")]]));
    expect(result.noResponse.map((item) => item.id)).toEqual(["quiet"]);
    expect(result.respondedStillCold.map((item) => item.id)).toEqual(["replied"]);
  });

  it("counts active outbox attempts and enforces cooldown", () => {
    expect(countRequalificationAttempts([{ status: "sent" }, { status: "failed" }, { status: "cancelled" }])).toBe(2);
    expect(isRequalificationInCooldown(new Date("2026-10-15T10:00:00Z"), new Date("2026-10-15T11:59:00Z"), 120)).toBe(true);
    expect(isRequalificationInCooldown(new Date("2026-10-15T10:00:00Z"), new Date("2026-10-15T12:00:00Z"), 120)).toBe(false);
  });

  it("blocks automatic follow-up after opt-out, inbound, or the attempt limit", () => {
    const base = {
      policy: { ...defaultColdLeadRequalificationPolicy, enabled: true },
      attempts: 1,
      hasInboundSinceLastPrompt: false,
      optedOut: false,
      wrongNumber: false,
      eligible: true,
      lastAttemptAt: null,
      now: new Date("2026-10-15T13:00:00Z"),
    };
    expect(requalificationSendDecision({ ...base, optedOut: true })).toMatchObject({ allowed: false });
    expect(requalificationSendDecision({ ...base, hasInboundSinceLastPrompt: true })).toMatchObject({ allowed: false });
    expect(requalificationSendDecision({ ...base, attempts: 3 })).toMatchObject({ allowed: false });
    expect(requalificationSendDecision({ ...base, attempts: 2 })).toEqual({ allowed: true });
  });

  it("uses 08:00-20:00 Sao Paulo business hours every day", () => {
    const beforeOpen = new Date("2026-10-15T10:59:00Z"); // 07:59 in Sao Paulo
    const atOpen = nextRequalificationBusinessWindowAt(beforeOpen);
    expect(atOpen.toISOString()).toBe("2026-10-15T11:00:00.000Z");
    expect(isWithinRequalificationBusinessWindow(atOpen)).toBe(true);
    const afterClose = new Date("2026-10-16T00:01:00Z"); // 21:01 in Sao Paulo
    expect(nextRequalificationBusinessWindowAt(afterClose).toISOString()).toBe("2026-10-16T11:00:00.000Z");
    expect(isWithinRequalificationBusinessWindow(afterClose)).toBe(false);
  });

  it("does not run the cron task when its advisory lock is already held", async () => {
    const task = vi.fn(async () => "sweep");
    const result = await runWithRequalificationLock(async () => false, task);
    expect(result).toEqual({ acquired: false });
    expect(task).not.toHaveBeenCalled();
  });
});

describe("automatic requalification (20/10: 3 hours after turning cold, once)", () => {
  const coldSince = new Date("2026-10-20T12:00:00.000Z");
  const at = (hours: number) => new Date(coldSince.getTime() + hours * 60 * 60_000);

  it("waits 3 hours, then sends only once", () => {
    expect(automaticRequalificationDue({ coldSince, attempts: 0, now: at(2.9) })).toBe(false);
    expect(automaticRequalificationDue({ coldSince, attempts: 0, now: at(3) })).toBe(true);
    expect(automaticRequalificationDue({ coldSince, attempts: 1, now: at(5) })).toBe(false);
  });

  it("leaves leads that turned cold more than 24 hours ago to the panel", () => {
    expect(automaticRequalificationDue({ coldSince, attempts: 0, now: at(24) })).toBe(true);
    expect(automaticRequalificationDue({ coldSince, attempts: 0, now: at(25) })).toBe(false);
  });

  it("counts the cold time from the qualification end, else the timeout hold, else the arrival", () => {
    const createdAt = new Date("2026-10-20T10:00:00.000Z");
    const hold = new Date("2026-10-20T10:15:00.000Z");
    const completed = new Date("2026-10-20T10:20:00.000Z");
    expect(coldSinceAt({ qualificationCompletedAt: completed, createdAt }, hold)).toEqual(completed);
    expect(coldSinceAt({ qualificationCompletedAt: null, createdAt }, hold)).toEqual(hold);
    expect(coldSinceAt({ qualificationCompletedAt: null, createdAt }, null)).toEqual(createdAt);
  });
});

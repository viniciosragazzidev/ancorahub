import { describe, expect, it } from "vitest";

import { earliestPacingRetryAt, evaluateBrokerOfferPacing, isOfferPacingEnabled, normalizeOfferPacing } from "./offer-pacing";

const now = new Date("2026-09-23T12:00:00Z");
const minutes = (value: number) => new Date(now.getTime() + value * 60_000);
const config = { intervalMinutes: 5, maxPending: 1 };

describe("normalizeOfferPacing", () => {
  it("defaults to 5 minutes and 1 pending offer", () => {
    expect(normalizeOfferPacing(undefined)).toEqual({ intervalMinutes: 5, maxPending: 1 });
    expect(normalizeOfferPacing({ intervalMinutes: null, maxPending: null })).toEqual({ intervalMinutes: 5, maxPending: 1 });
  });

  it("keeps 0 as disabled and clamps negatives", () => {
    expect(normalizeOfferPacing({ intervalMinutes: 0, maxPending: 0 })).toEqual({ intervalMinutes: 0, maxPending: 0 });
    expect(normalizeOfferPacing({ intervalMinutes: -3, maxPending: -1 })).toEqual({ intervalMinutes: 0, maxPending: 0 });
    expect(isOfferPacingEnabled({ intervalMinutes: 0, maxPending: 0 })).toBe(false);
    expect(isOfferPacingEnabled({ intervalMinutes: 0, maxPending: 2 })).toBe(true);
  });
});

describe("evaluateBrokerOfferPacing", () => {
  it("allows a broker with no offers", () => {
    expect(evaluateBrokerOfferPacing([], config, now)).toEqual({ allowed: true, retryAt: null, rule: null });
  });

  it("blocks until the interval since the latest offer has elapsed", () => {
    const decision = evaluateBrokerOfferPacing([{ status: "ACCEPTED", offeredAt: minutes(-2), expiresAt: minutes(1) }], config, now);
    expect(decision).toEqual({ allowed: false, retryAt: minutes(3), rule: "interval" });
  });

  it("allows again exactly when the interval elapses", () => {
    const offers = [{ status: "ACCEPTED", offeredAt: minutes(-5), expiresAt: minutes(-2) }];
    expect(evaluateBrokerOfferPacing(offers, config, now).allowed).toBe(true);
  });

  it("uses the most recent offer, not the oldest", () => {
    const offers = [
      { status: "EXPIRED", offeredAt: minutes(-20), expiresAt: minutes(-17) },
      { status: "DECLINED", offeredAt: minutes(-1), expiresAt: minutes(2) },
    ];
    expect(evaluateBrokerOfferPacing(offers, config, now)).toMatchObject({ allowed: false, retryAt: minutes(4) });
  });

  it("does not count cancelled offers (technical failures)", () => {
    const offers = [{ status: "CANCELLED", offeredAt: minutes(-1), expiresAt: minutes(2) }];
    expect(evaluateBrokerOfferPacing(offers, config, now).allowed).toBe(true);
  });

  it("blocks while the pending limit is reached even if the interval is disabled", () => {
    const offers = [{ status: "SENT", offeredAt: minutes(-2), expiresAt: minutes(1) }];
    const decision = evaluateBrokerOfferPacing(offers, { intervalMinutes: 0, maxPending: 1 }, now);
    expect(decision).toEqual({ allowed: false, retryAt: minutes(1), rule: "pending" });
  });

  it("ignores pending offers that already expired", () => {
    const offers = [{ status: "PENDING", offeredAt: minutes(-10), expiresAt: minutes(-7) }];
    expect(evaluateBrokerOfferPacing(offers, { intervalMinutes: 0, maxPending: 1 }, now).allowed).toBe(true);
  });

  it("allows up to maxPending simultaneous offers", () => {
    const offers = [{ status: "PENDING", offeredAt: minutes(-2), expiresAt: minutes(1) }];
    expect(evaluateBrokerOfferPacing(offers, { intervalMinutes: 0, maxPending: 2 }, now).allowed).toBe(true);
    const two = [...offers, { status: "DELIVERED", offeredAt: minutes(-1), expiresAt: minutes(2) }];
    expect(evaluateBrokerOfferPacing(two, { intervalMinutes: 0, maxPending: 2 }, now)).toMatchObject({ allowed: false, retryAt: minutes(1) });
  });

  it("picks the later of the two rules for the retry time", () => {
    const offers = [{ status: "READ", offeredAt: minutes(-1), expiresAt: minutes(2) }];
    expect(evaluateBrokerOfferPacing(offers, config, now)).toEqual({ allowed: false, retryAt: minutes(4), rule: "interval" });
  });

  it("does nothing when both rules are disabled", () => {
    const offers = [{ status: "PENDING", offeredAt: minutes(-1), expiresAt: minutes(2) }];
    expect(evaluateBrokerOfferPacing(offers, { intervalMinutes: 0, maxPending: 0 }, now).allowed).toBe(true);
  });

  it("simulates a released backlog: 5 brokers receive one lead per interval, never a burst", () => {
    const brokers = ["a", "b", "c", "d", "e"];
    const history = new Map<string, Array<{ status: string; offeredAt: Date; expiresAt: Date }>>(brokers.map((id) => [id, []]));
    const delivered: Array<{ minute: number; brokerId: string }> = [];
    for (let minute = 0; minute <= 20; minute += 1) {
      const at = minutes(minute);
      for (let lead = 0; lead < 50; lead += 1) {
        const broker = brokers.find((id) => evaluateBrokerOfferPacing(history.get(id)!, config, at).allowed);
        if (!broker) break;
        history.get(broker)!.push({ status: "ACCEPTED", offeredAt: at, expiresAt: minutes(minute + 3) });
        delivered.push({ minute, brokerId: broker });
      }
    }
    // 5 offers at minutes 0, 5, 10, 15 and 20 = 25 in total, one per broker per tick.
    expect(delivered).toHaveLength(25);
    for (const brokerId of brokers) {
      expect(delivered.filter((item) => item.brokerId === brokerId).map((item) => item.minute)).toEqual([0, 5, 10, 15, 20]);
    }
  });
});

describe("earliestPacingRetryAt", () => {
  it("returns the soonest release among blocked brokers", () => {
    expect(earliestPacingRetryAt([
      { allowed: false, retryAt: minutes(4), rule: "interval" },
      { allowed: true, retryAt: null, rule: null },
      { allowed: false, retryAt: minutes(2), rule: "pending" },
    ])).toEqual(minutes(2));
  });

  it("returns null when nobody is blocked", () => {
    expect(earliestPacingRetryAt([{ allowed: true, retryAt: null, rule: null }])).toBeNull();
  });
});

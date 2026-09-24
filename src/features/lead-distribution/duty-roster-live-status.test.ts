import { describe, expect, it } from "vitest";

import { classifyBrokerLiveOfferStatus } from "./duty-roster-live-status";

const now = new Date("2026-09-24T12:00:00Z");
const minutes = (value: number) => new Date(now.getTime() + value * 60_000);
const pacing = { intervalMinutes: 5, maxPending: 1 };
const base = { blockedReason: null, capacity: 7, activeLeads: 2, pacing, offers: [], now };

describe("classifyBrokerLiveOfferStatus", () => {
  it("is blocked when the roster prerequisites fail, regardless of everything else", () => {
    expect(classifyBrokerLiveOfferStatus({ ...base, blockedReason: "Sem telefone cadastrado" }))
      .toEqual({ status: "blocked", nextEventAt: null });
  });

  it("is capacity_full at the limit even with no active offer", () => {
    expect(classifyBrokerLiveOfferStatus({ ...base, activeLeads: 7 }))
      .toEqual({ status: "capacity_full", nextEventAt: null });
  });

  it("is not capacity_full when capacity is disabled (null)", () => {
    expect(classifyBrokerLiveOfferStatus({ ...base, capacity: null, activeLeads: 999 }).status).not.toBe("capacity_full");
  });

  it("is offer_pending with the offer's own expiry as the countdown target", () => {
    const offers = [{ status: "SENT", offeredAt: minutes(-1), expiresAt: minutes(2) }];
    expect(classifyBrokerLiveOfferStatus({ ...base, offers })).toEqual({ status: "offer_pending", nextEventAt: minutes(2) });
  });

  it("ignores an expired offer for offer_pending, falling through to cooldown while the interval is still open", () => {
    const offers = [{ status: "SENT", offeredAt: minutes(-3), expiresAt: minutes(-1) }];
    expect(classifyBrokerLiveOfferStatus({ ...base, offers })).toEqual({ status: "cooldown", nextEventAt: minutes(2) });
  });

  it("is cooldown with the pacing release as the countdown target", () => {
    const offers = [{ status: "ACCEPTED", offeredAt: minutes(-2), expiresAt: minutes(1) }];
    expect(classifyBrokerLiveOfferStatus({ ...base, offers })).toEqual({ status: "cooldown", nextEventAt: minutes(3) });
  });

  it("is ready with no offers and capacity to spare", () => {
    expect(classifyBrokerLiveOfferStatus(base)).toEqual({ status: "ready", nextEventAt: null });
  });

  it("is ready again once the pacing interval has fully elapsed", () => {
    const offers = [{ status: "DECLINED", offeredAt: minutes(-6), expiresAt: minutes(-3) }];
    expect(classifyBrokerLiveOfferStatus({ ...base, offers })).toEqual({ status: "ready", nextEventAt: null });
  });

  it("does not let a cancelled offer count toward cooldown", () => {
    const offers = [{ status: "CANCELLED", offeredAt: minutes(-1), expiresAt: minutes(2) }];
    expect(classifyBrokerLiveOfferStatus({ ...base, offers })).toEqual({ status: "ready", nextEventAt: null });
  });

  it("prioritizes blocked over capacity_full over offer_pending over cooldown", () => {
    const offers = [{ status: "SENT", offeredAt: minutes(-1), expiresAt: minutes(2) }];
    expect(classifyBrokerLiveOfferStatus({ ...base, blockedReason: "Conta inativa", activeLeads: 7, offers }).status).toBe("blocked");
    expect(classifyBrokerLiveOfferStatus({ ...base, activeLeads: 7, offers }).status).toBe("capacity_full");
  });
});

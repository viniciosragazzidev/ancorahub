import { describe, expect, it } from "vitest";
import { shouldShowExpiredOfferLanding } from "./expired-offer-landing";

const expiredOffer = {
  brokerId: "broker-1",
  status: "EXPIRED",
  acceptedAt: null,
};

describe("shouldShowExpiredOfferLanding", () => {
  it("shows the notice only to the broker whose latest offer expired without acceptance", () => {
    expect(shouldShowExpiredOfferLanding({
      role: "broker",
      brokerId: "broker-1",
      currentLeadOwnerId: "broker-2",
      latestOffer: expiredOffer,
    })).toBe(true);
  });

  it("does not show the notice when the broker still owns the lead", () => {
    expect(shouldShowExpiredOfferLanding({
      role: "broker",
      brokerId: "broker-1",
      currentLeadOwnerId: "broker-1",
      latestOffer: expiredOffer,
    })).toBe(false);
  });

  it("does not show the notice to another role or for another broker's offer", () => {
    expect(shouldShowExpiredOfferLanding({
      role: "manager",
      brokerId: "broker-1",
      currentLeadOwnerId: "broker-2",
      latestOffer: expiredOffer,
    })).toBe(false);
    expect(shouldShowExpiredOfferLanding({
      role: "broker",
      brokerId: "broker-1",
      currentLeadOwnerId: "broker-2",
      latestOffer: { ...expiredOffer, brokerId: "broker-2" },
    })).toBe(false);
  });

  it("does not show for accepted, pending, missing, or replaced offers", () => {
    const ineligibleOffers = [
      { ...expiredOffer, status: "ACCEPTED" },
      { ...expiredOffer, status: "PENDING" },
      { ...expiredOffer, status: "REPLACED" },
      { ...expiredOffer, acceptedAt: new Date("2026-10-29T12:00:00Z") },
      null,
    ];

    for (const latestOffer of ineligibleOffers) {
      expect(shouldShowExpiredOfferLanding({
        role: "broker",
        brokerId: "broker-1",
        currentLeadOwnerId: "broker-2",
        latestOffer,
      })).toBe(false);
    }
  });
});

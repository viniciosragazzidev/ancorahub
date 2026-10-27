import { describe, expect, it } from "vitest";

import { leadHasBlockingOffer, orderByPreference, selectUnambiguousActiveOffer } from "./offers";

describe("selectUnambiguousActiveOffer", () => {
  it("returns the only active offer", () => {
    const offer = { id: "offer-1", status: "PENDING" };
    expect(selectUnambiguousActiveOffer([offer])).toBe(offer);
  });

  it("rejects ambiguous active offers", () => {
    expect(selectUnambiguousActiveOffer([
      { id: "offer-1", status: "SENT" },
      { id: "offer-2", status: "READ" },
    ])).toBeNull();
  });

  it("ignores terminal offers when selecting", () => {
    const offer = { id: "offer-1", status: "PENDING" };
    expect(selectUnambiguousActiveOffer([
      { id: "offer-old", status: "EXPIRED" },
      offer,
    ])).toBe(offer);
  });
});

describe("leadHasBlockingOffer (DEC-154: a lead with an active offer is not picked again)", () => {
  const now = new Date("2026-10-27T13:00:00.000Z");
  const later = new Date("2026-10-27T13:10:00.000Z");
  const offer = (status: string, overrides: { expiresAt?: Date; outboundMessageId?: string | null } = {}) => ({
    status,
    offeredAt: new Date("2026-10-27T12:55:00.000Z"),
    expiresAt: overrides.expiresAt ?? later,
    outboundMessageId: overrides.outboundMessageId ?? "msg-1",
  });

  it("blocks while an offer with a linked message is still awaiting a response", () => {
    expect(leadHasBlockingOffer([offer("PENDING")], now)).toBe(true);
    expect(leadHasBlockingOffer([offer("READ")], now)).toBe(true);
  });

  it("does not block when the only offers are terminal or expired", () => {
    expect(leadHasBlockingOffer([offer("EXPIRED"), offer("DECLINED"), offer("CANCELLED")], now)).toBe(false);
    expect(leadHasBlockingOffer([offer("PENDING", { expiresAt: new Date("2026-10-27T12:59:00.000Z") })], now)).toBe(false);
  });

  it("does not block when there are no offers", () => {
    expect(leadHasBlockingOffer([], now)).toBe(false);
  });
});

describe("orderByPreference", () => {
  it("keeps the ranking order (fewest leads first), not the database's", () => {
    const fromDatabase = [{ id: "barbara" }, { id: "luciana" }, { id: "luiz" }, { id: "marco" }];
    expect(orderByPreference(fromDatabase, ["luiz", "marco", "barbara", "luciana"]).map((broker) => broker.id))
      .toEqual(["luiz", "marco", "barbara", "luciana"]);
  });

  it("sends brokers missing from the ranking to the end", () => {
    expect(orderByPreference([{ id: "x" }, { id: "a" }], ["a"]).map((broker) => broker.id)).toEqual(["a", "x"]);
  });
});

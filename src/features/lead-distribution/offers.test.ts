import { describe, expect, it } from "vitest";

import { orderByPreference, selectUnambiguousActiveOffer } from "./offers";

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

import { describe, expect, it } from "vitest";

import { selectUnambiguousActiveOffer } from "./offers";

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

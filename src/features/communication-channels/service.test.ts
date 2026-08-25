import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getMetaDeliveryFailure, matchesKnownBrokerPhone } from "./service";

describe("broker official channel routing", () => {
  it("recognizes a broker phone despite WhatsApp formatting", () => {
    expect(matchesKnownBrokerPhone("5521999991234", ["+55 (21) 99999-1234"])).toBe(true);
  });

  it("does not classify an unrelated inbound number as a broker", () => {
    expect(matchesKnownBrokerPhone("5521999999876", ["+55 (21) 99999-1234"])).toBe(false);
  });

  it("keeps the provider delivery code without persisting a raw error payload", () => {
    expect(getMetaDeliveryFailure({ errors: [{ code: 131026, title: "Message Undeliverable", message: "raw provider payload" }] })).toEqual({
      code: "131026",
      message: "Message Undeliverable",
    });
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { matchesKnownBrokerPhone } from "./service";

describe("broker official channel routing", () => {
  it("recognizes a broker phone despite WhatsApp formatting", () => {
    expect(matchesKnownBrokerPhone("5521999991234", ["+55 (21) 99999-1234"])).toBe(true);
  });

  it("does not classify an unrelated inbound number as a broker", () => {
    expect(matchesKnownBrokerPhone("5521999999876", ["+55 (21) 99999-1234"])).toBe(false);
  });
});

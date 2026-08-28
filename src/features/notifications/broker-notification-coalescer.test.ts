import { describe, expect, it } from "vitest";
import { BROKER_COALESCE_WINDOW_MS } from "./broker-notification-coalescer";

describe("broker-notification-coalescing", () => {
  it("defines a 3-minute (180,000ms) coalesce window to prevent WhatsApp spam", () => {
    expect(BROKER_COALESCE_WINDOW_MS).toBe(180_000);
  });
});

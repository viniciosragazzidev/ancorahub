import { describe, expect, it } from "vitest";

import {
  getWhatsAppTestFailureMessage,
  normalizeWhatsAppDestination,
} from "./whatsapp-diagnostic-copy";

describe("normalizeWhatsAppDestination", () => {
  it("adds Brazil's country code when a local Brazilian mobile number is entered", () => {
    expect(normalizeWhatsAppDestination("(21) 95930-7782")).toBe("5521959307782");
  });

  it("keeps a number that already includes the country code", () => {
    expect(normalizeWhatsAppDestination("+55 21 95930-7782")).toBe("5521959307782");
  });
});

describe("getWhatsAppTestFailureMessage", () => {
  it("turns Meta's unregistered-account error into an actionable, safe message", () => {
    expect(getWhatsAppTestFailureMessage({ code: 133010, status: 400 })).toContain(
      "conta WhatsApp registrada"
    );
  });

  it("does not expose an unknown provider error to the interface", () => {
    expect(getWhatsAppTestFailureMessage(new Error("provider internals"))).not.toContain("provider internals");
  });
});

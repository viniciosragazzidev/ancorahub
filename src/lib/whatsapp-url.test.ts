import { describe, expect, it } from "vitest";

import { buildWhatsAppUrl, normalizeWhatsAppDestination } from "./whatsapp-url";

describe("normalizeWhatsAppDestination", () => {
  it("adds the ninth digit to a legacy Brazilian mobile destination", () => {
    expect(normalizeWhatsAppDestination("+55 21 9721-6462")).toBe("5521997216462");
  });

  it("keeps Brazilian landlines and already normalized mobile numbers unchanged", () => {
    expect(normalizeWhatsAppDestination("+55 21 3216-6462")).toBe("552132166462");
    expect(normalizeWhatsAppDestination("+55 21 99721-6462")).toBe("5521997216462");
  });

  it("preserves international destinations", () => {
    expect(normalizeWhatsAppDestination("+1 (415) 555-2671")).toBe("14155552671");
  });

  it("uses the normalized destination in the WhatsApp Web URL", () => {
    expect(buildWhatsAppUrl("552197216462", "Ol\u00e1")).toBe("https://wa.me/5521997216462?text=Ol%C3%A1");
  });
});

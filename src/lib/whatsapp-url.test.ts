import { describe, expect, it } from "vitest";

import {
  buildWhatsAppAppUrl,
  buildWhatsAppUrl,
  buildWhatsAppWebUrl,
  isMobileWhatsAppDevice,
  normalizeWhatsAppDestination,
  parseWhatsAppUrl,
  toDeviceWhatsAppUrl,
} from "./whatsapp-url";

describe("normalizeWhatsAppDestination", () => {
  it("adds the ninth digit to a legacy Brazilian mobile destination", () => {
    expect(normalizeWhatsAppDestination("+55 21 9721-6462")).toBe("5521997216462");
  });

  it("keeps Brazilian landlines and already normalized mobile numbers unchanged", () => {
    expect(normalizeWhatsAppDestination("+55 21 3216-6462")).toBe("552132166462");
    expect(normalizeWhatsAppDestination("+55 21 99721-6462")).toBe("5521997216462");
  });

  it("adds the 55 country code to a local number", () => {
    expect(normalizeWhatsAppDestination("(21) 99721-6462")).toBe("5521997216462");
  });

  it("preserves international destinations", () => {
    expect(normalizeWhatsAppDestination("+1 (415) 555-2671")).toBe("14155552671");
  });
});

describe("WhatsApp links", () => {
  it("builds the WhatsApp Web link straight to the chat, with 55 and the encoded text", () => {
    expect(buildWhatsAppWebUrl("(21) 99721-6462", "Olá, Maria! Tudo bem?")).toBe("https://web.whatsapp.com/send?phone=5521997216462&text=Ol%C3%A1%2C%20Maria!%20Tudo%20bem%3F");
    expect(buildWhatsAppWebUrl("21997216462")).toBe("https://web.whatsapp.com/send?phone=5521997216462");
    expect(buildWhatsAppWebUrl(null, "Oi")).toBe("https://web.whatsapp.com/send?text=Oi");
  });

  it("builds the app link for phones", () => {
    expect(buildWhatsAppAppUrl("21997216462", "Oi & tchau")).toBe("whatsapp://send?phone=5521997216462&text=Oi%20%26%20tchau");
  });

  it("is the Web link by default, the app link on mobile, null without a phone", () => {
    expect(buildWhatsAppUrl("552197216462", "Olá")).toBe("https://web.whatsapp.com/send?phone=5521997216462&text=Ol%C3%A1");
    expect(buildWhatsAppUrl("552197216462", undefined, "mobile")).toBe("whatsapp://send?phone=5521997216462");
    expect(buildWhatsAppUrl("")).toBeNull();
    expect(buildWhatsAppUrl(null)).toBeNull();
  });
});

describe("parseWhatsAppUrl / toDeviceWhatsAppUrl", () => {
  it("reads every send link format", () => {
    expect(parseWhatsAppUrl("https://wa.me/5521997216462?text=Oi%20Maria")).toEqual({ phone: "5521997216462", text: "Oi Maria" });
    expect(parseWhatsAppUrl("https://wa.me/21997216462")).toEqual({ phone: "5521997216462", text: null });
    expect(parseWhatsAppUrl("https://api.whatsapp.com/send?phone=5521997216462&text=Oi")).toEqual({ phone: "5521997216462", text: "Oi" });
    expect(parseWhatsAppUrl("https://web.whatsapp.com/send?phone=5521997216462")).toEqual({ phone: "5521997216462", text: null });
    expect(parseWhatsAppUrl("whatsapp://send?phone=5521997216462&text=Oi")).toEqual({ phone: "5521997216462", text: "Oi" });
    expect(parseWhatsAppUrl("https://wa.me/?text=Oi")).toEqual({ phone: null, text: "Oi" });
  });

  it("undoes the double 55 of old builders but keeps a real DDD 55 number", () => {
    expect(parseWhatsAppUrl("https://wa.me/555521997216462")?.phone).toBe("5521997216462");
    expect(parseWhatsAppUrl("https://wa.me/5555997216462")?.phone).toBe("5555997216462");
  });

  it("ignores links that are not a WhatsApp send", () => {
    expect(parseWhatsAppUrl("https://web.whatsapp.com/")).toBeNull();
    expect(parseWhatsAppUrl("/leads/1")).toBeNull();
    expect(parseWhatsAppUrl("https://example.com/send?phone=1")).toBeNull();
    expect(parseWhatsAppUrl("tel:21997216462")).toBeNull();
    expect(parseWhatsAppUrl(null)).toBeNull();
  });

  it("rewrites wa.me for the device", () => {
    expect(toDeviceWhatsAppUrl("https://wa.me/21997216462?text=Oi", "desktop")).toBe("https://web.whatsapp.com/send?phone=5521997216462&text=Oi");
    expect(toDeviceWhatsAppUrl("https://wa.me/21997216462?text=Oi", "mobile")).toBe("whatsapp://send?phone=5521997216462&text=Oi");
    expect(toDeviceWhatsAppUrl("https://example.com", "mobile")).toBeNull();
  });
});

describe("isMobileWhatsAppDevice", () => {
  it("detects phones by user agent or a coarse main pointer", () => {
    expect(isMobileWhatsAppDevice({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" })).toBe(true);
    expect(isMobileWhatsAppDevice({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile" })).toBe(true);
    expect(isMobileWhatsAppDevice({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", coarsePointer: true })).toBe(true);
    expect(isMobileWhatsAppDevice({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0", coarsePointer: false })).toBe(false);
  });
});

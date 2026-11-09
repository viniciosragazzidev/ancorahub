import { describe, expect, it } from "vitest";

import { detectWhatsAppPlatform, WHATSAPP_BUSINESS_PACKAGE, whatsappAppUrl } from "./open-whatsapp-app";

describe("abrir o app do WhatsApp sem entrar em conversa (09/11)", () => {
  it("reconhece Android, iPhone e o resto", () => {
    expect(detectWhatsAppPlatform("Mozilla/5.0 (Linux; Android 14; SM-A145M) Chrome/130")).toBe("android");
    expect(detectWhatsAppPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios");
    expect(detectWhatsAppPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("other");
  });

  it("usa o endereço que o WhatsApp atende (send), sem número nem texto: só abre o app", () => {
    for (const platform of ["android", "ios", "other"] as const) {
      expect(whatsappAppUrl(platform)).toContain("send");
      expect(whatsappAppUrl(platform)).not.toMatch(/phone=|text=|wa\.me/);
    }
  });

  it("no iPhone abre o app pelo whatsapp://send", () => {
    expect(whatsappAppUrl("ios")).toBe("whatsapp://send");
  });

  it("no Android abre pelo pacote, com o Business e o fallback quando pedidos", () => {
    expect(whatsappAppUrl("android")).toBe("intent://send#Intent;scheme=whatsapp;package=com.whatsapp;end");
    const business = whatsappAppUrl("android", { pkg: WHATSAPP_BUSINESS_PACKAGE, fallbackUrl: "https://crm.ancorasaude.cloud/plantoes/agora#x" });
    expect(business).toContain("package=com.whatsapp.w4b;");
    expect(business).toContain("S.browser_fallback_url=https%3A%2F%2Fcrm.ancorasaude.cloud%2Fplantoes%2Fagora%23x;");
  });
});

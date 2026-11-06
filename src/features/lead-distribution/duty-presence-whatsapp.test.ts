import { describe, expect, it } from "vitest";

import { decideWhatsAppPresence, presenceRequiresWhatsApp } from "./duty-presence-whatsapp";

describe("presença exige WhatsApp a partir de 06/11/2026", () => {
  it("vale a partir de 06/11 no horário de São Paulo", () => {
    // 23:59 de 05/11 em São Paulo = 02:59 UTC de 06/11.
    expect(presenceRequiresWhatsApp({ flag: "true", now: new Date("2026-11-06T02:59:00Z") })).toBe(false);
    expect(presenceRequiresWhatsApp({ flag: "true", now: new Date("2026-11-06T03:00:00Z") })).toBe(true);
    expect(presenceRequiresWhatsApp({ flag: undefined, now: new Date("2026-12-01T12:00:00Z") })).toBe(true);
  });

  it("a flag desligada solta a regra", () => {
    expect(presenceRequiresWhatsApp({ flag: "false", now: new Date("2026-12-01T12:00:00Z") })).toBe(false);
  });

  it("com a regra valendo: conectado passa; desconectado ou sem sessão não passa", () => {
    expect(decideWhatsAppPresence({ required: true, hasSession: true, live: "ready" })).toEqual({ allowed: true, reason: "connected" });
    expect(decideWhatsAppPresence({ required: true, hasSession: true, live: "disconnected" })).toEqual({ allowed: false });
    expect(decideWhatsAppPresence({ required: true, hasSession: true, live: "initializing" })).toEqual({ allowed: false });
    expect(decideWhatsAppPresence({ required: true, hasSession: false, live: null })).toEqual({ allowed: false });
  });

  it("serviço do WhatsApp fora do ar: libera (falha nossa não trava o plantão)", () => {
    expect(decideWhatsAppPresence({ required: true, hasSession: true, live: undefined })).toEqual({ allowed: true, reason: "service_unavailable" });
  });

  it("regra desligada: passa sem olhar a conexão", () => {
    expect(decideWhatsAppPresence({ required: false, hasSession: false, live: null })).toEqual({ allowed: true, reason: "not_required" });
  });
});

import { describe, expect, it } from "vitest";

import { whatsappHref } from "./clientes-lite";

describe("atalho de WhatsApp da carteira", () => {
  it("usa só dígitos e põe o 55 quando falta o DDI", () => {
    expect(whatsappHref("+5583986436210")).toBe("https://wa.me/5583986436210");
    expect(whatsappHref("(21) 98342-2360")).toBe("https://wa.me/5521983422360");
    expect(whatsappHref("123")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { isBrokerPartnershipMessage } from "./broker-acquisition-message";

describe("partnership ad message (Aquisição Corretores)", () => {
  it("recognizes the ad's ready message and small variations", () => {
    expect(isBrokerPartnershipMessage("Sou corretor(a) e quero conhecer a parceria da Âncora.")).toBe(true);
    expect(isBrokerPartnershipMessage("sou corretora e quero conhecer a parceria da ancora")).toBe(true);
    expect(isBrokerPartnershipMessage("Olá! Sou corretor e quero saber da parceria")).toBe(true);
  });

  it("leaves customers and other messages alone", () => {
    expect(isBrokerPartnershipMessage("Gostaria de receber uma cotação de plano de saúde empresarial")).toBe(false);
    expect(isBrokerPartnershipMessage("Quero falar com um corretor sobre plano")).toBe(false);
    expect(isBrokerPartnershipMessage("Vocês têm parceria com a Amil?")).toBe(false);
    expect(isBrokerPartnershipMessage("")).toBe(false);
    expect(isBrokerPartnershipMessage(null)).toBe(false);
  });
});

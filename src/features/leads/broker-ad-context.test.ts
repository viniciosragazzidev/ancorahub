import { describe, expect, it } from "vitest";

import { canEditCampaignBrokerOffer } from "@/features/meta-ads/broker-brief-policy";

import { BROKER_AD_CONTEXT_KEYS, brokerAdEntry, brokerAdKeys, buildBrokerAdContext } from "./broker-ad-context";

const formLead = {
  sourceChannel: "meta_lead_ads",
  sourceAd: "120200000000000001",
  sourceCampaign: "120200000000000009",
  metaAdId: "120200000000000001",
  metaCampaignId: "120200000000000009",
  // Tudo o que o lead guarda de interno: nada disso pode sair para o corretor.
  sourceMetadata: { campaignName: "PME RJ CBO teste 3", pageId: "999", campaignResolution: "explicit", formAnswers: ["Idade: 40"] },
};

const creative = { title: "Amil custo-benefício", body: "A partir de R$ 89", mediaType: "image" as const, imageUrl: "https://cdn.example/a.jpg" };

describe("o que o corretor vê do anúncio", () => {
  it("mostra o plano anunciado e o criativo, e só essas chaves", () => {
    const context = buildBrokerAdContext({ lead: formLead, creative, offer: "  Amil   custo-benefício, individual  " });
    expect(context).toEqual({
      entry: "form",
      offer: "Amil custo-benefício, individual",
      title: "Amil custo-benefício",
      body: "A partir de R$ 89",
      mediaType: "image",
      imageUrl: "https://cdn.example/a.jpg",
    });
    expect(Object.keys(context!).sort()).toEqual([...BROKER_AD_CONTEXT_KEYS].sort());
    const serialized = JSON.stringify(context);
    for (const secret of ["PME RJ CBO teste 3", "120200000000000001", "120200000000000009", "999", "Idade"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("WhatsApp do anúncio usa o título já gravado enquanto a Graph não responde", () => {
    const lead = { ...formLead, sourceMetadata: { entry: "whatsapp", adHeadline: "Plano para MEI", campaignName: "Interno" } };
    expect(buildBrokerAdContext({ lead, creative: null, offer: null })).toEqual({
      entry: "whatsapp", offer: null, title: "Plano para MEI", body: null, mediaType: null, imageUrl: null,
    });
  });

  it("lead que não veio de anúncio não tem cartão", () => {
    for (const sourceChannel of ["meta_ads", "landing_page", "manual", null]) {
      expect(brokerAdEntry({ sourceChannel, sourceMetadata: null })).toBeNull();
      expect(buildBrokerAdContext({ lead: { ...formLead, sourceChannel }, creative, offer: "Plano" })).toBeNull();
    }
  });

  it("anúncio sem nenhum conteúdo também não tem cartão", () => {
    expect(buildBrokerAdContext({ lead: formLead, creative: { title: null, body: null, mediaType: "image", imageUrl: null }, offer: "   " })).toBeNull();
  });

  it("descarta imagem que não é https", () => {
    expect(buildBrokerAdContext({ lead: formLead, creative: { ...creative, imageUrl: "http://x.example/a.jpg" }, offer: null })?.imageUrl).toBeNull();
  });

  it("busca o criativo e a oferta só pelos IDs numéricos do lead de anúncio", () => {
    expect(brokerAdKeys(formLead)).toEqual({ adId: "120200000000000001", campaignId: "120200000000000009" });
    // Importação CSV guarda nomes, não IDs.
    expect(brokerAdKeys({ ...formLead, sourceChannel: "meta_ads" })).toEqual({ adId: null, campaignId: null });
    expect(brokerAdKeys({ ...formLead, metaAdId: null, sourceAd: "Anúncio 1", metaCampaignId: null, sourceCampaign: "Campanha" })).toEqual({ adId: null, campaignId: null });
  });

  it("só diretor, gestor e marketing escrevem o plano anunciado", () => {
    expect(canEditCampaignBrokerOffer({ role: "director" })).toBe(true);
    expect(canEditCampaignBrokerOffer({ role: "manager" })).toBe(true);
    expect(canEditCampaignBrokerOffer({ role: "employee", jobTitle: "marketing" })).toBe(true);
    expect(canEditCampaignBrokerOffer({ role: "broker" })).toBe(false);
    expect(canEditCampaignBrokerOffer({ role: "supervisor" })).toBe(false);
  });
});

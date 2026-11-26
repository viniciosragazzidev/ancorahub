import { describe, expect, it } from "vitest";

import {
  buildPostSaleTestMessage,
  duplicatePostSaleCampaignDraft,
  postSaleAudienceToForm,
  postSaleTestIdempotencyKey,
  postSaleTestQuota,
} from "./campaign-test";

describe("montagem do teste", () => {
  it("WAHA: o texto inicial com as variáveis trocadas pelo cliente de exemplo", () => {
    const message = buildPostSaleTestMessage({
      channelType: "waha",
      openingMessage: "Oi, {{nome}}! Aqui é a {{assistente}}, da {{empresa}}. {{corretor}} cuidou de você.",
      exampleName: "Maria Clara Souza",
      companyName: "Âncora",
      assistantName: "Sasá",
      brokerName: "João Pedro",
    });
    expect(message).toEqual({ channelType: "waha", body: "Oi, Maria! Aqui é a Sasá, da Âncora. João cuidou de você." });
  });

  it("Meta: as 3 variáveis do template, na mesma ordem do disparo", () => {
    const message = buildPostSaleTestMessage({ channelType: "meta", openingMessage: "", exampleName: "Ana", companyName: "Âncora", assistantName: null, brokerName: "Paulo Lima" });
    expect(message.channelType).toBe("meta");
    if (message.channelType !== "meta") return;
    expect(message.variables).toEqual(["Ana", "Âncora", "Paulo"]);
    expect(message.body).toContain("Olá, Ana!");
    expect(message.body).not.toContain("{{");
  });

  it("usa os mesmos padrões do disparo quando falta dado", () => {
    const message = buildPostSaleTestMessage({ channelType: "waha", openingMessage: "{{nome}} {{empresa}} {{assistente}} {{corretor}}", exampleName: null, companyName: " ", assistantName: undefined, brokerName: null });
    expect(message.body).toBe("Cliente nossa equipe equipe de qualidade nosso corretor");
  });
});

describe("limite de 3 testes por hora", () => {
  const now = new Date("2026-11-26T15:00:00.000Z");
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

  it("conta só a última hora", () => {
    expect(postSaleTestQuota([minutesAgo(10), minutesAgo(70)], now)).toEqual({ remaining: 2, retryAt: null });
  });

  it("no limite, diz quando abre a próxima vaga", () => {
    const quota = postSaleTestQuota([minutesAgo(50), minutesAgo(20), minutesAgo(5)], now);
    expect(quota.remaining).toBe(0);
    expect(quota.retryAt?.toISOString()).toBe(new Date(minutesAgo(50).getTime() + 3_600_000).toISOString());
  });

  it("chave do teste nunca colide com a de uma pesquisa", () => {
    expect(postSaleTestIdempotencyKey("user-1", now)).toBe(`post-sale-test:user-1:${now.getTime()}`);
  });
});

describe("duplicar envio", () => {
  it("copia público e texto, com (cópia) no nome sem repetir", () => {
    const audience = { kind: "broker" as const, brokerId: "b1", arrivalFrom: "2026-11-01" };
    expect(duplicatePostSaleCampaignDraft({ name: "Pós-venda novembro", audience, openingMessage: "Oi {{nome}}, tudo bem por aí?" }))
      .toEqual({ name: "Pós-venda novembro (cópia)", audience, openingMessage: "Oi {{nome}}, tudo bem por aí?" });
    expect(duplicatePostSaleCampaignDraft({ name: "Pós-venda (cópia)", audience, openingMessage: "Oi {{nome}}, tudo bem por aí?" }).name).toBe("Pós-venda (cópia)");
  });

  it("nome longo continua cabendo em 120 caracteres", () => {
    const draft = duplicatePostSaleCampaignDraft({ name: "x".repeat(120), audience: { kind: "lead", leadId: "l1" }, openingMessage: null });
    expect(draft.name.length).toBe(120);
    expect(draft.name.endsWith(" (cópia)")).toBe(true);
    expect(draft.openingMessage.length).toBeGreaterThan(20);
  });

  it("leva o público salvo para o formulário", () => {
    expect(postSaleAudienceToForm({ kind: "filters", types: [], statuses: [], queueId: "q1", arrivalTo: "2026-11-20" })).toEqual({ kind: "queue", queueId: "q1", from: "", to: "2026-11-20" });
    expect(postSaleAudienceToForm({ kind: "filters", types: [], statuses: [] })).toEqual({ kind: "period", from: "", to: "" });
    expect(postSaleAudienceToForm({ kind: "lead", leadId: "l1" })).toEqual({ kind: "leadIds", leadIds: ["l1"] });
  });
});

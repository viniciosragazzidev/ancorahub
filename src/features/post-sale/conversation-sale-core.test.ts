import { describe, expect, it } from "vitest";

import {
  applySaleChoice,
  applySaleText,
  livesLine,
  mergeContractReading,
  nextSaleBlocks,
  parseSaleAges,
  parseSaleDate,
  parseSaleMoney,
  resetSaleAnswers,
  saleAwaiting,
  type SaleCatalog,
} from "./conversation-sale-core";
import { parseContractReading } from "./sale-contract-reading";

const catalog: SaleCatalog = {
  carriers: [
    { id: "amil", name: "Amil", plans: [{ id: "amil-s380", name: "Amil S380", type: "familiar" }, { id: "amil-pme", name: "Amil PME One", type: "pme" }] },
    { id: "sulamerica", name: "SulAmérica", plans: [] },
  ],
};
const today = new Date(2026, 10, 19);

describe("registrar venda em conversa", () => {
  it("pergunta na ordem: tipo, idades, operadora, plano, valor e vigência", () => {
    let answers = {};
    expect(saleAwaiting(answers, catalog)).toBe("planType");
    answers = applySaleChoice(answers, "planType:familiar", catalog)!;
    expect(saleAwaiting(answers, catalog)).toBe("ages");
    const ages = applySaleText(answers, "35, 32 e 8", catalog, today);
    expect("answers" in ages && ages.answers.ages).toEqual([35, 32, 8]);
    answers = "answers" in ages ? ages.answers : answers;
    expect(saleAwaiting(answers, catalog)).toBe("carrier");
    answers = applySaleChoice(answers, "carrier:amil", catalog)!;
    expect(saleAwaiting(answers, catalog)).toBe("plan");
    answers = applySaleChoice(answers, "plan:amil-s380", catalog)!;
    expect(saleAwaiting(answers, catalog)).toBe("value");
    const value = applySaleText(answers, "R$ 1.250,90", catalog, today);
    answers = "answers" in value ? value.answers : answers;
    expect(saleAwaiting(answers, catalog)).toBe("start");
    answers = applySaleChoice(answers, "start:2026-12-01", catalog)!;
    expect(saleAwaiting(answers, catalog)).toBe("done");
    expect(nextSaleBlocks(answers, catalog, { turn: 1, today, leadValue: null }).map((block) => block.type)).toEqual(["facts", "question"]);
  });

  it("operadora fora do catálogo ou sem planos pula a pergunta do plano", () => {
    const outside = applySaleChoice({ planType: "individual", ages: [40] }, "carrier:", catalog)!;
    expect(saleAwaiting(outside, catalog)).toBe("value");
    const noPlans = applySaleChoice({ planType: "individual", ages: [40] }, "carrier:sulamerica", catalog)!;
    expect(saleAwaiting(noPlans, catalog)).toBe("value");
  });

  it("ignora resposta que não é da pergunta em aberto", () => {
    expect(applySaleChoice({}, "carrier:amil", catalog)).toBeNull();
  });

  it("confere idades, valor e data", () => {
    expect(parseSaleAges("35, 30", "individual")).toHaveProperty("error");
    expect(parseSaleAges("35", "pme")).toHaveProperty("error");
    expect(parseSaleMoney("1.250,90")).toEqual({ value: 1250.9 });
    expect(parseSaleMoney("1.250")).toEqual({ value: 1250 });
    expect(parseSaleMoney("890.5")).toEqual({ value: 890.5 });
    expect(parseSaleDate("10/12", today)).toEqual({ date: "2026-12-10" });
    expect(parseSaleDate("31/02/2027", today)).toHaveProperty("error");
    expect(livesLine([35, 32, 8])).toBe("3 vidas: titular de 35 e 2 dependentes (32 e 8)");
  });

  it("corrigir apaga só o trecho escolhido", () => {
    const full = { planType: "familiar" as const, ages: [35, 8], carrierId: "amil", planId: "amil-s380", monthlyValue: 900, coverageStartDate: "2026-12-01" };
    expect(saleAwaiting(resetSaleAnswers(full, "carrier"), catalog)).toBe("carrier");
    expect(resetSaleAnswers(full, "carrier").monthlyValue).toBe(900);
  });

  it("o contrato lido preenche tudo e casa operadora e plano pelo nome", () => {
    const reading = parseContractReading('```json\n{"planType":"familiar","ages":[35,"32",8],"carrierName":"AMIL Assistência Médica","planName":"amil s380","monthlyValue":"1.250,90","coverageStartDate":"2026-12-01"}\n```');
    expect(reading?.monthlyValue).toBe(1250.9);
    const merged = mergeContractReading({}, reading!, catalog);
    expect(merged.answers).toMatchObject({ planType: "familiar", ages: [35, 32, 8], carrierId: "amil", planId: "amil-s380", monthlyValue: 1250.9, coverageStartDate: "2026-12-01", fromContract: true });
    expect(saleAwaiting(merged.answers, catalog)).toBe("done");
  });

  it("contrato sem o valor pergunta só o que faltou", () => {
    const merged = mergeContractReading({}, { ages: [40], carrierName: "Amil", planName: "Amil S380", coverageStartDate: "2026-12-01" }, catalog);
    expect(merged.answers.planType).toBe("individual");
    expect(saleAwaiting(merged.answers, catalog)).toBe("value");
    const unknownPlan = mergeContractReading({}, { ages: [40], carrierName: "Amil", planName: "Plano Ouro" }, catalog);
    expect(saleAwaiting(unknownPlan.answers, catalog)).toBe("plan");
  });

  it("resposta da IA sem JSON não vira leitura", () => {
    expect(parseContractReading("não consegui ler")).toBeNull();
  });
});

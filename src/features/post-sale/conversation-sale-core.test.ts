import { describe, expect, it } from "vitest";

import {
  applySaleChoice,
  applySaleText,
  holderAge,
  parseSaleBirthDate,
  parseSaleDocument,
  withHolderAge,
  livesLine,
  mergeContractReading,
  nextSaleBlocks,
  parseSaleAges,
  parseSaleDate,
  parseSaleMoney,
  resetSaleAnswers,
  saleAwaiting,
  saleReviewData,
  type SaleAnswers,
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
/** Titular já confirmado: os testes do resto do fluxo começam depois dele. */
const HOLDER = { holder: { name: "Ana Souza", document: { kind: "cpf" as const, digits: "52998224725" }, birthDate: "1990-05-10" } };

describe("registrar venda em conversa", () => {
  it("começa confirmando o titular: nome, CPF ou CNPJ e nascimento", () => {
    let answers: SaleAnswers = {};
    expect(saleAwaiting(answers, catalog)).toBe("holderName");
    const ask = nextSaleBlocks(answers, catalog, { turn: 1, today, leadValue: null, leadName: "Ana Souza" })[0];
    expect(ask).toMatchObject({ type: "question", prompt: "Primeiro, o titular. É Ana Souza?" });
    answers = applySaleChoice(answers, "holder:lead", catalog, "Ana Souza")!;
    expect(saleAwaiting(answers, catalog)).toBe("holderDoc");
    expect(applySaleText(answers, "111.111.111-11", catalog, today)).toHaveProperty("error");
    const doc = applySaleText(answers, "529.982.247-25", catalog, today);
    answers = "answers" in doc ? doc.answers : answers;
    expect(saleAwaiting(answers, catalog)).toBe("holderBirth");
    const birth = applySaleText(answers, "10/05/1990", catalog, today);
    answers = "answers" in birth ? birth.answers : answers;
    expect(holderAge(answers, today)).toBe(36);
    expect(saleAwaiting(answers, catalog)).toBe("planType");
  });

  it("outra pessoa: pergunta o nome; empresa com CNPJ não pede nascimento", () => {
    let answers: SaleAnswers = applySaleChoice({}, "holder:other", catalog, "Ana Souza")!;
    expect(saleAwaiting(answers, catalog)).toBe("holderName");
    expect(applySaleText(answers, "A1", catalog, today)).toHaveProperty("error");
    const named = applySaleText(answers, "  Padaria   Boa Vista  ", catalog, today);
    answers = "answers" in named ? named.answers : answers;
    expect(answers.holder?.name).toBe("Padaria Boa Vista");
    const cnpj = applySaleText(answers, "11.222.333/0001-81", catalog, today);
    answers = "answers" in cnpj ? cnpj.answers : answers;
    expect(answers.holder?.document).toEqual({ kind: "cnpj", digits: "11222333000181" });
    expect(saleAwaiting(answers, catalog)).toBe("planType");
  });

  it("confere documento e nascimento; individual usa a idade do titular", () => {
    expect(parseSaleDocument("123")).toHaveProperty("error");
    expect(parseSaleBirthDate("31/02/1990", today)).toHaveProperty("error");
    expect(parseSaleBirthDate("10/05/2030", today)).toHaveProperty("error");
    expect(withHolderAge({ ...HOLDER, planType: "individual" }, today).ages).toEqual([36]);
    const family = applySaleText({ ...HOLDER, planType: "familiar" }, "8, 5", catalog, today);
    expect("answers" in family && family.answers.ages).toEqual([36, 8, 5]);
  });

  it("pergunta na ordem: tipo, idades, operadora, plano, valor e vigência", () => {
    let answers: SaleAnswers = { ...HOLDER };
    expect(saleAwaiting(answers, catalog)).toBe("planType");
    answers = applySaleChoice(answers, "planType:familiar", catalog)!;
    expect(saleAwaiting(answers, catalog)).toBe("ages");
    const ages = applySaleText(answers, "32 e 8", catalog, today);
    expect("answers" in ages && ages.answers.ages).toEqual([36, 32, 8]);
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
    expect(nextSaleBlocks(answers, catalog, { turn: 1, today, leadValue: null }).map((block) => block.type)).toEqual(["custom", "question"]);
  });

  it("operadora fora do catálogo ou sem planos pula a pergunta do plano", () => {
    const outside = applySaleChoice({ ...HOLDER, planType: "individual", ages: [40] }, "carrier:", catalog)!;
    expect(saleAwaiting(outside, catalog)).toBe("value");
    const noPlans = applySaleChoice({ ...HOLDER, planType: "individual", ages: [40] }, "carrier:sulamerica", catalog)!;
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
    const full = { ...HOLDER, planType: "familiar" as const, ages: [35, 8], carrierId: "amil", planId: "amil-s380", monthlyValue: 900, coverageStartDate: "2026-12-01" };
    expect(saleAwaiting(resetSaleAnswers(full, "carrier"), catalog)).toBe("carrier");
    expect(resetSaleAnswers(full, "carrier").monthlyValue).toBe(900);
  });

  it("o contrato lido preenche tudo e casa operadora e plano pelo nome", () => {
    const reading = parseContractReading('```json\n{"planType":"familiar","ages":[35,"32",8],"carrierName":"AMIL Assistência Médica","planName":"amil s380","monthlyValue":"1.250,90","coverageStartDate":"2026-12-01"}\n```');
    expect(reading?.monthlyValue).toBe(1250.9);
    const merged = mergeContractReading({ ...HOLDER }, reading!, catalog);
    expect(merged.answers).toMatchObject({ planType: "familiar", ages: [35, 32, 8], carrierId: "amil", planId: "amil-s380", monthlyValue: 1250.9, coverageStartDate: "2026-12-01", fromContract: true });
    expect(saleAwaiting(merged.answers, catalog)).toBe("done");
  });

  it("contrato sem o valor pergunta só o que faltou", () => {
    const merged = mergeContractReading({ ...HOLDER }, { ages: [40], carrierName: "Amil", planName: "Amil S380", coverageStartDate: "2026-12-01" }, catalog);
    expect(merged.answers.planType).toBe("individual");
    expect(saleAwaiting(merged.answers, catalog)).toBe("value");
    const unknownPlan = mergeContractReading({ ...HOLDER }, { ages: [40], carrierName: "Amil", planName: "Plano Ouro" }, catalog);
    expect(saleAwaiting(unknownPlan.answers, catalog)).toBe("plan");
  });

  it("resposta da IA sem JSON não vira leitura", () => {
    expect(parseContractReading("não consegui ler")).toBeNull();
  });

  it("o contrato completo traz titular, dependentes, apólice, pagamento e prazo", () => {
    const reading = parseContractReading(JSON.stringify({
      planType: "familiar",
      holder: { name: "CARLOS EDUARDO DA SILVA", birthDate: "1988-03-14", cpf: "529.982.247-25" },
      dependents: [{ name: "juliana silva", birthDate: "1991-12-30", relationship: "conjuge" }, { name: "Pedro", age: 8, relationship: "filho" }],
      carrierName: "Amil", planName: "Amil S380", monthlyValue: 1890.42, coverageStartDate: "2026-12-01",
      policyNumber: "PRP-118734", paymentMethod: "boleto", contractTermMonths: 24,
    }))!;
    expect(reading.holder).toMatchObject({ name: "Carlos Eduardo da Silva", cpf: "52998224725", relationship: "titular" });
    const merged = mergeContractReading({}, reading, catalog, today);
    expect(merged.answers.ages).toEqual([38, 34, 8]);
    expect(merged.answers.people?.map((person) => person.relationship)).toEqual(["titular", "conjuge", "filho"]);
    expect(merged.answers).toMatchObject({ policyNumber: "PRP-118734", paymentMethod: "boleto", contractTermMonths: 24 });
    expect(saleAwaiting(merged.answers, catalog)).toBe("done");
    expect(merged.rows.find((row) => row.key === "dependents")?.value).toBe("2: Juliana e Pedro");
    const review = saleReviewData(merged.answers, catalog);
    expect(merged.answers.holder).toEqual({ name: "Carlos Eduardo da Silva", document: { kind: "cpf", digits: "52998224725" }, birthDate: "1988-03-14" });
    expect(review.sections[0].rows.map((row) => row.value)).toEqual(["Carlos Eduardo da Silva", "529.982.247-25", "14/03/1988", "Juliana Silva, 34 anos", "Pedro, 8 anos"]);
    expect(review.sections[2].rows.find((row) => row.label === "Prazo")).toMatchObject({ value: "24 meses", sourced: true });
  });

  it("idades escritas à mão descartam as pessoas do contrato", () => {
    const merged = mergeContractReading({}, { holder: { name: "Ana", age: 40, birthDate: null, cpf: null, relationship: "titular" } }, catalog, today);
    const reset = resetSaleAnswers(merged.answers, "type");
    expect(reset.people).toBeUndefined();
    expect(reset.sourced).not.toContain("people");
  });
});

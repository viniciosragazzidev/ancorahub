import { describe, expect, it } from "vitest";
import { quoteInputSchema } from "../contracts";
import {
  dinheiro,
  explicarPendencia,
  montarEntrada,
  orcamentoEmCentavos,
  podeGerarProposta,
  validarCidade,
  validarVidas,
  type Vida,
} from "./cotacao-lite-model";

const titular: Vida = { key: 1, age: "35", holder: true, relationship: "" };
const dependente: Vida = { key: 2, age: "", holder: false, relationship: "Filho" };

describe("validarVidas", () => {
  it("exige exatamente um titular", () => {
    expect(validarVidas([])).toBe("Indique exatamente um titular.");
    expect(validarVidas([titular, { ...titular, key: 3 }])).toBe("Indique exatamente um titular.");
  });

  it("aponta a idade faltando com o número do dependente", () => {
    expect(validarVidas([titular, dependente])).toBe("Informe a idade do dependente 1 para calcular os valores.");
  });

  it("recusa idade fora da faixa ou não inteira", () => {
    expect(validarVidas([{ ...titular, age: "121" }])).toMatch(/entre 0 e 120/);
    expect(validarVidas([{ ...titular, age: "35,5" }])).toMatch(/entre 0 e 120/);
  });

  it("aceita um grupo completo", () => {
    expect(validarVidas([titular, { ...dependente, age: "7" }])).toBeNull();
  });
});

describe("orcamentoEmCentavos", () => {
  it("converte o texto em reais para centavos", () => {
    expect(orcamentoEmCentavos("1.500,00")).toBe(150000);
    expect(orcamentoEmCentavos("1500")).toBe(150000);
    expect(orcamentoEmCentavos("20,5")).toBe(2050);
  });

  it("vazio é sem orçamento e zero ou lixo é inválido", () => {
    expect(orcamentoEmCentavos("  ")).toBeNull();
    expect(orcamentoEmCentavos("0")).toBe("invalido");
    expect(orcamentoEmCentavos("abc")).toBe("invalido");
  });
});

describe("explicarPendencia e podeGerarProposta", () => {
  it("só planos prontos podem gerar proposta", () => {
    expect(podeGerarProposta({ state: "ready" })).toBe(true);
    expect(podeGerarProposta({ state: "pending" })).toBe(false);
    expect(podeGerarProposta({ state: "incompatible" })).toBe(false);
  });

  it("texto claro para pendência, sem ponto duplicado", () => {
    expect(explicarPendencia({ state: "pending", reasons: ["Idade limite não confirmada."] })).toBe(
      "Falta confirmar: Idade limite não confirmada. Confirme com a operadora ou com a sua equipe antes de gerar a proposta.",
    );
    expect(explicarPendencia({ state: "ready", reasons: [] })).toBe("");
  });
});

describe("validarCidade", () => {
  it("PME exige cidade, o restante não", () => {
    expect(validarCidade("PME_EMPRESARIAL", " ")).toMatch(/município/);
    expect(validarCidade("ADESAO", "")).toBeNull();
  });
});

describe("montarEntrada", () => {
  it("gera uma entrada que passa no schema do contrato", () => {
    const entrada = montarEntrada(
      {
        modality: "ADESAO",
        vidas: [titular, { ...dependente, age: "7" }],
        city: " São Paulo ",
        operator: "",
        businessMonths: "",
        budget: "1.200,00",
        query: " ",
        includeIncompatible: false,
      },
      1,
    );
    expect(entrada.lives).toEqual([
      { age: 35, holder: true, relationship: "Titular" },
      { age: 7, holder: false, relationship: "Filho" },
    ]);
    expect(entrada.city).toBe("São Paulo");
    expect(entrada.budgetCents).toBe(120000);
    expect(entrada.businessMonths).toBeNull();
    expect(() => quoteInputSchema.parse(entrada)).not.toThrow();
  });
});

describe("dinheiro", () => {
  it("formata em BRL", () => {
    expect(dinheiro(123456).replace(/\u00a0/g, " ")).toBe("R$ 1.234,56");
  });
});

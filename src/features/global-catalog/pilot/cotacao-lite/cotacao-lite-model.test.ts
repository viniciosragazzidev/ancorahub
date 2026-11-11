import { describe, expect, it } from "vitest";
import { quoteInputSchema } from "../contracts";
import {
  dinheiro,
  explicarPendencia,
  montarEntrada,
  motivosDoPlano,
  orcamentoEmCentavos,
  passosDaModalidade,
  podeGerarProposta,
  validarCidade,
  validarPerfil,
  validarVidas,
  type EntradaCotacao,
  type Vida,
} from "./cotacao-lite-model";

const titular: Vida = { key: 1, age: "35", holder: true, relationship: "" };
const dependente: Vida = { key: 2, age: "", holder: false, relationship: "Filho(a)" };
const perfilVazio = { businessProfile: "", businessMonths: "", profession: "", entity: "" };

function entradaBase(extra: Partial<EntradaCotacao>): EntradaCotacao {
  return {
    modality: "PESSOA_FISICA",
    vidas: [titular],
    city: " São Paulo ",
    perfil: perfilVazio,
    budget: "",
    query: " ",
    includeIncompatible: false,
    ...extra,
  };
}

describe("passosDaModalidade", () => {
  it("pessoa física pula o perfil; PME e adesão incluem o perfil", () => {
    expect(passosDaModalidade("PESSOA_FISICA")).toEqual(["modalidade", "cidade", "vidas", "refino"]);
    expect(passosDaModalidade("PME_EMPRESARIAL")).toContain("perfil");
    expect(passosDaModalidade("ADESAO_ODONTO")).toContain("perfil");
    expect(passosDaModalidade(null)).not.toContain("perfil");
  });
});

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

describe("validarPerfil", () => {
  it("PME exige tipo de empresa e tempo de empresa em meses", () => {
    expect(validarPerfil("PME_EMPRESARIAL", perfilVazio)).toBe("Escolha o tipo de empresa.");
    expect(validarPerfil("PME_EMPRESARIAL", { ...perfilVazio, businessProfile: "ME" })).toMatch(/tempo de empresa/);
    expect(validarPerfil("PME_EMPRESARIAL", { ...perfilVazio, businessProfile: "ME", businessMonths: "12" })).toBeNull();
    expect(validarPerfil("PME_EMPRESARIAL", { ...perfilVazio, businessProfile: "ME", businessMonths: "-1" })).toMatch(/tempo de empresa/);
  });

  it("adesão e pessoa física não exigem perfil", () => {
    expect(validarPerfil("ADESAO", perfilVazio)).toBeNull();
    expect(validarPerfil("PESSOA_FISICA", perfilVazio)).toBeNull();
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

describe("explicarPendencia, motivosDoPlano e podeGerarProposta", () => {
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

  it("lista todos os motivos sem pontuação final", () => {
    expect(motivosDoPlano({ state: "pending", reasons: ["A.", "B"] })).toEqual(["A", "B"]);
  });
});

describe("validarCidade", () => {
  it("PME exige cidade, o restante não", () => {
    expect(validarCidade("PME_EMPRESARIAL", " ")).toMatch(/município/);
    expect(validarCidade("ADESAO", "")).toBeNull();
  });
});

describe("montarEntrada", () => {
  it("gera uma entrada de adesão que passa no schema do contrato", () => {
    const entrada = montarEntrada(
      entradaBase({
        modality: "ADESAO",
        vidas: [titular, { ...dependente, age: "7" }],
        budget: "1.200,00",
        perfil: { ...perfilVazio, profession: " Professor ", entity: "Sindicato X" },
      }),
      1,
    );
    expect(entrada.lives).toEqual([
      { age: 35, holder: true, relationship: "Titular" },
      { age: 7, holder: false, relationship: "Filho(a)" },
    ]);
    expect(entrada.city).toBe("São Paulo");
    expect(entrada.budgetCents).toBe(120000);
    expect(entrada.businessMonths).toBeNull();
    expect(entrada.profession).toBe("Professor");
    expect(entrada.entity).toBe("Sindicato X");
    expect(() => quoteInputSchema.parse(entrada)).not.toThrow();
  });

  it("PME leva o perfil e o tempo de empresa", () => {
    const entrada = montarEntrada(
      entradaBase({ modality: "PME_EMPRESARIAL", perfil: { ...perfilVazio, businessProfile: "ME", businessMonths: "18" } }),
      2,
    );
    expect(entrada.businessProfile).toBe("ME");
    expect(entrada.businessMonths).toBe(18);
    expect(entrada.profession).toBe("");
    expect(entrada.page).toBe(2);
    expect(() => quoteInputSchema.parse(entrada)).not.toThrow();
  });
});

describe("dinheiro", () => {
  it("formata em BRL", () => {
    expect(dinheiro(123456).replace(/ /g, " ")).toBe("R$ 1.234,56");
  });
});

// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { cidadeCombina, partesDestacadas } from "./cotacao-lite-cidade";

describe("cidadeCombina", () => {
  it("acha sem acento e sem diferença de caixa", () => {
    expect(cidadeCombina("São Paulo", "sao")).toBe(1);
    expect(cidadeCombina("São Paulo", "SÃO PAU")).toBe(1);
    expect(cidadeCombina("Rio de Janeiro", "belo")).toBe(0);
  });

  it("busca vazia mostra todas", () => {
    expect(cidadeCombina("Campinas", "")).toBe(1);
  });
});

describe("partesDestacadas", () => {
  it("marca o trecho buscado no texto original, com acento", () => {
    expect(partesDestacadas("São Paulo", "paulo")).toEqual([
      { trecho: "São ", marcado: false },
      { trecho: "Paulo", marcado: true },
    ]);
  });

  it("marca quando a busca não tem acento e o nome tem", () => {
    expect(partesDestacadas("São Paulo", "sao")).toEqual([
      { trecho: "São", marcado: true },
      { trecho: " Paulo", marcado: false },
    ]);
  });

  it("sem busca ou sem casamento, devolve o texto inteiro sem marca", () => {
    expect(partesDestacadas("Recife", "")).toEqual([{ trecho: "Recife", marcado: false }]);
    expect(partesDestacadas("Recife", "xyz")).toEqual([{ trecho: "Recife", marcado: false }]);
  });
});

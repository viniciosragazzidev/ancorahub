import { describe, expect, it } from "vitest";

import { formatarValor, lerValor, mascararValorDigitado, valorEmCentavos } from "./dinheiro";

describe("lerValor: devolve centavos inteiros", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["1234.56", 123456],
    ["1,234.56", 123456],
    ["R$ 1.234,56", 123456],
    ["R$1234", 123400],
    ["r$ 1234", 123400],
    ["1234", 123400],
    ["1.234", 123400],
    ["1.234.567", 123456700],
    ["1,234,567", 123456700],
    ["1 234,50", 123450],
    ["1 234,50", 123450],
    ["12,5", 1250],
    ["12.5", 1250],
    ["0,99", 99],
    [",5", 50],
    ["10,", 1000],
    ["1,5 mil", 150000],
    ["1.5mil", 150000],
    ["2 mil", 200000],
    ["2k", 200000],
    ["2,5K", 250000],
    ["1.234,567", 123457],
    ["0,005", 1],
    ["0,004", 0],
    ["0", 0],
    ["500 reais", 50000],
    ["BRL 99,90", 9990],
  ])("%s → %d", (entrada, centavos) => {
    expect(valorEmCentavos(entrada)).toBe(centavos);
  });

  it("aceita número", () => {
    expect(valorEmCentavos(1234.56)).toBe(123456);
    expect(valorEmCentavos(0.1 + 0.2)).toBe(30);
    expect(lerValor(-1)).toMatchObject({ ok: false, motivo: "negativo" });
    expect(lerValor(Number.NaN)).toMatchObject({ ok: false, motivo: "formato" });
  });

  it.each([
    ["", "vazio"], ["   ", "vazio"], [null, "vazio"], ["R$", "vazio"], ["-10", "negativo"], ["abc", "formato"], ["1,2,3", "formato"],
    ["1.2.3", "formato"], ["12a", "formato"], ["mil", "formato"], [".", "formato"], ["1,234.5,6", "formato"],
  ] as const)("recusa %s (%s)", (entrada, motivo) => {
    expect(lerValor(entrada)).toMatchObject({ ok: false, motivo });
  });

  it("devolve a exibição junto", () => {
    expect(lerValor("1234.5")).toEqual({ ok: true, centavos: 123450, exibicao: "R$ 1.234,50" });
  });
});

describe("formatarValor", () => {
  it.each([[0, "R$ 0,00"], [5, "R$ 0,05"], [123456, "R$ 1.234,56"], [100000000, "R$ 1.000.000,00"], [-1050, "-R$ 10,50"]])("%d → %s", (centavos, texto) => {
    expect(formatarValor(centavos)).toBe(texto);
  });
});

describe("mascararValorDigitado", () => {
  it("põe o milhar enquanto digita", () => {
    expect(["1", "12", "123", "1234", "12345", "123456", "1234567"].map((t) => mascararValorDigitado(t)))
      .toEqual(["1", "12", "123", "1.234", "12.345", "123.456", "1.234.567"]);
  });

  it("deixa escrever vírgula e até 2 casas", () => {
    expect(mascararValorDigitado("1.234,")).toBe("1.234,");
    expect(mascararValorDigitado("1.234,5")).toBe("1.234,5");
    expect(mascararValorDigitado("1.234,567")).toBe("1.234,56");
    expect(mascararValorDigitado(",5")).toBe("0,5");
    expect(mascararValorDigitado("12,3,4")).toBe("12,34");
  });

  it("digitando, ponto é milhar: apagar 1.234 até 1.23 não vira decimal", () => {
    expect(mascararValorDigitado("1.23")).toBe("123");
    expect(mascararValorDigitado("1.2345")).toBe("12.345");
  });

  it("colado ou com letras passa pelo leitor", () => {
    expect(mascararValorDigitado("R$ 1234.56")).toBe("1.234,56");
    expect(mascararValorDigitado("1234.56", { colado: true })).toBe("1.234,56");
    expect(mascararValorDigitado("1,5 mil")).toBe("1.500,00");
    expect(mascararValorDigitado("")).toBe("");
  });
});

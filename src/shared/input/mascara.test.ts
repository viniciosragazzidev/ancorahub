import { describe, expect, it } from "vitest";

import { aplicarMascara } from "./mascara";

/** Simula digitar `texto` no fim do campo, tecla por tecla, como o navegador faria. */
function digitar(tipo: Parameters<typeof aplicarMascara>[0], texto: string, inicial = "") {
  let valor = inicial;
  for (const tecla of texto) {
    const bruto = valor + tecla;
    valor = aplicarMascara(tipo, { valor: bruto, cursor: bruto.length, anterior: valor, tipoEntrada: "insertText" }).valor;
  }
  return valor;
}

describe("aplicarMascara: digitação", () => {
  it("telefone, CPF, CNPJ, valor e data tecla por tecla", () => {
    expect(digitar("telefone", "21999991234")).toBe("(21) 99999-1234");
    expect(digitar("cpf", "52998224725")).toBe("529.982.247-25");
    expect(digitar("cnpj", "11222333000181")).toBe("11.222.333/0001-81");
    expect(digitar("valor", "1234,56")).toBe("1.234,56");
    expect(digitar("data", "01022026")).toBe("01/02/2026");
    expect(digitar("data", "1/2/2026")).toBe("01/02/2026");
  });

  it("letra é recusada sem mexer no resto", () => {
    expect(digitar("telefone", "21a9")).toBe("(21) 9");
    expect(digitar("cpf", "529x")).toBe("529");
  });

  it("no valor, o ponto do teclado em inglês vira vírgula decimal", () => {
    expect(digitar("valor", "12.5")).toBe("12,5");
    expect(digitar("valor", "1234.5")).toBe("1.234,5");
  });
});

describe("aplicarMascara: cursor", () => {
  it("editar no meio não pula o cursor para o fim", () => {
    // "(21) 99999-1234": troca o DDD inserindo "1" depois do "2" → "(211) ..." vira "(21) 19999-91234"
    const anterior = "(21) 99999-1234";
    const bruto = "(2" + "1" + "1) 99999-1234";
    const r = aplicarMascara("telefone", { valor: bruto, cursor: 4, anterior, tipoEntrada: "insertText" });
    expect(r.valor).toBe("(21) 19999-9123");
    expect(r.valor.slice(0, r.cursor)).toBe("(21) 1"); // logo depois do 3º dígito, o "1" digitado
  });

  it("digitar no meio do CPF mantém o cursor depois do dígito novo", () => {
    const anterior = "529.982.247";
    const bruto = "529.9182.247";
    const r = aplicarMascara("cpf", { valor: bruto, cursor: 6, anterior, tipoEntrada: "insertText" });
    expect(r.valor).toBe("529.918.224-7");
    expect(r.valor.slice(0, r.cursor)).toBe("529.91");
  });

  it("apagar um separador apaga o número ao lado em vez de travar", () => {
    // Backspace logo depois do "-" de "(21) 99999-1234": o navegador tira o "-".
    const anterior = "(21) 99999-1234";
    const r = aplicarMascara("telefone", { valor: "(21) 999991234", cursor: 10, anterior, tipoEntrada: "deleteContentBackward" });
    expect(r.valor).toBe("(21) 9999-1234");
    expect(r.valor.slice(0, r.cursor)).toBe("(21) 9999");
  });

  it("Delete antes do ponto do CPF apaga o dígito seguinte", () => {
    const anterior = "529.982.247-25";
    const r = aplicarMascara("cpf", { valor: "529982.247-25", cursor: 3, anterior, tipoEntrada: "deleteContentForward" });
    expect(r.valor).toBe("529.822.472-5");
    expect(r.cursor).toBe(3);
  });

  it("apagar o ponto de milhar do valor apaga o dígito antes dele", () => {
    const r = aplicarMascara("valor", { valor: "1234", cursor: 1, anterior: "1.234", tipoEntrada: "deleteContentBackward" });
    expect(r.valor).toBe("234");
    expect(r.cursor).toBe(0);
  });

  it("prefixo tirado na colagem (0 de discagem) não desloca o cursor", () => {
    const r = aplicarMascara("telefone", { valor: "021999991234", cursor: 12, anterior: "", tipoEntrada: "insertFromPaste" });
    expect(r).toEqual({ valor: "(21) 99999-1234", cursor: 15 });
  });
});

describe("aplicarMascara: colar bagunçado", () => {
  it.each([
    ["telefone", "+55 (21) 99999-1234", "+55 (21) 99999-1234"],
    ["telefone", "5521999991234", "(21) 99999-1234"],
    ["cpf", "CPF 529 982 247 25", "529.982.247-25"],
    ["cnpj", "11222333000181", "11.222.333/0001-81"],
    ["valor", "R$ 1234.56", "1.234,56"],
    ["valor", "1234.56", "1.234,56"],
    ["valor", "1,5 mil", "1.500,00"],
    ["data", "2026-02-01", "01/02/2026"],
  ] as const)("%s: %s → %s", (tipo, colado, esperado) => {
    const r = aplicarMascara(tipo, { valor: colado, cursor: colado.length, anterior: "", tipoEntrada: "insertFromPaste" });
    expect(r.valor).toBe(esperado);
    expect(r.cursor).toBe(esperado.length);
  });

  it("autocompletar do navegador (sem inputType) também conta como colagem", () => {
    expect(aplicarMascara("valor", { valor: "99.90", cursor: 5, anterior: "" }).valor).toBe("99,90");
  });
});

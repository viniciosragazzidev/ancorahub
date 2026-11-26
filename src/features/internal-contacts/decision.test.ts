import { describe, expect, it } from "vitest";

import {
  buildInternalDirectory,
  classifyInternalContact,
  formatInternalNumberLines,
  internalContactCode,
  internalPhoneKey,
  lastFourDigits,
  parseInternalNumberLines,
  parseInternalNumbers,
  sameInternalPhone,
} from "./decision";

describe("internalPhoneKey", () => {
  it("trata como o mesmo número celular com e sem 9 e com e sem 55", () => {
    const variants = ["+55 21 99646-2596", "5521996462596", "21996462596", "(21) 99646-2596", "552196462596", "2196462596", "5521996462596@c.us", "021996462596"];
    const keys = new Set(variants.map(internalPhoneKey));
    expect(keys).toEqual(new Set(["2196462596"]));
  });

  it("aceita fixo de 10 dígitos com e sem 55", () => {
    expect(internalPhoneKey("(11) 3333-4444")).toBe("1133334444");
    expect(internalPhoneKey("55 11 3333-4444")).toBe(internalPhoneKey("1133334444"));
  });

  it("não confunde DDDs diferentes", () => {
    expect(sameInternalPhone("21996462596", "11996462596")).toBe(false);
  });

  it("recusa o que não é telefone do Brasil", () => {
    for (const value of ["", null, undefined, "12345", "4421996462596", "123456789012345@lid", "21896462596", "00996462596"]) {
      expect(internalPhoneKey(value)).toBeNull();
    }
  });
});

describe("classifyInternalContact", () => {
  const directory = buildInternalDirectory({
    team: [{ phone: "+55 21 99646-2596", name: "Ana Lima" }, { phone: null, name: "Sem telefone" }],
    list: [{ phone: "5511999990000", label: "Fornecedor" }, { phone: "5521996462596", label: "Repetido da equipe" }],
  });

  it("reconhece a equipe primeiro, mesmo sem o 9", () => {
    expect(classifyInternalContact("552196462596", directory)).toEqual({ internal: true, reason: "team_member", label: "Ana Lima" });
  });

  it("reconhece a lista do diretor", () => {
    const decision = classifyInternalContact("11 99999-0000", directory);
    expect(decision).toEqual({ internal: true, reason: "internal_list", label: "Fornecedor" });
    if (decision.internal) expect(internalContactCode(decision)).toBe("internal_contact_list");
  });

  it("deixa passar cliente e telefone inválido", () => {
    expect(classifyInternalContact("21988887777", directory)).toEqual({ internal: false });
    expect(classifyInternalContact("abc", directory)).toEqual({ internal: false });
  });
});

describe("lista digitada", () => {
  it("lê número e nome por linha, guarda com 55 e separa inválidos e repetidos", () => {
    const parsed = parseInternalNumberLines("(21) 99999-0000 Fornecedor X\n\n11 3333-4444 · Operadora\n21 9999-0000 de novo\nfulano");
    expect(parsed.numbers).toEqual([
      { phone: "5521999990000", label: "Fornecedor X" },
      { phone: "551133334444", label: "Operadora" },
    ]);
    expect(parsed.repeated).toEqual(["21 9999-0000 de novo"]);
    expect(parsed.invalid).toEqual(["fulano"]);
  });

  it("volta para o texto do campo e lê o valor guardado sem quebrar", () => {
    const numbers = [{ phone: "5521999990000", label: "Fornecedor" }, { phone: "551133334444", label: "" }];
    expect(formatInternalNumberLines(numbers)).toBe("(21) 99999-0000 Fornecedor\n(11) 3333-4444");
    expect(parseInternalNumbers(JSON.stringify([...numbers, { phone: "21 99999-0000", label: "dup" }, { phone: "x" }, null]))).toEqual(numbers);
    expect(parseInternalNumbers("não é json")).toEqual([]);
  });

  it("mostra só os 4 últimos dígitos", () => {
    expect(lastFourDigits("+55 21 99646-2596")).toBe("final 2596");
    expect(lastFourDigits("")).toBe("sem número");
  });
});

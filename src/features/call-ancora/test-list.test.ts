import { describe, expect, it } from "vitest";

import { CALL_ANCORA_TEST_LIST_MAX, formatBrPhone, maskPhone, normalizeBrPhone, parseCallAncoraTestList } from "./test-list";

describe("lista de teste do Call Âncora", () => {
  it("normaliza celulares e fixos brasileiros", () => {
    expect(normalizeBrPhone("(21) 99999-0000")).toBe("+5521999990000");
    expect(normalizeBrPhone("+55 21 99999-0000")).toBe("+5521999990000");
    expect(normalizeBrPhone("2133334444")).toBe("+552133334444");
  });

  it("recusa números fora do padrão", () => {
    expect(normalizeBrPhone("+55 00 0000-0001")).toBeNull();
    expect(normalizeBrPhone("21 89999-0000")).toBeNull();
    expect(normalizeBrPhone("123")).toBeNull();
  });

  it("lê nome opcional antes ou depois e ignora repetidos", () => {
    const result = parseCallAncoraTestList("Ana; (21) 99999-0000\n(21) 98888-7777 | Bruno\n21999990000\n\nxyz");
    expect(result.entries).toEqual([
      { name: "Ana", phone: "+5521999990000" },
      { name: "Bruno", phone: "+5521988887777" },
    ]);
    expect(result.errors).toEqual(["Linha 4: número inválido."]);
  });

  it("limita a 50 números", () => {
    const text = Array.from({ length: CALL_ANCORA_TEST_LIST_MAX + 1 }, (_, i) => `2199999${String(i).padStart(4, "0")}`).join("\n");
    expect(parseCallAncoraTestList(text).errors.at(-1)).toContain("50");
  });

  it("formata e mascara", () => {
    expect(formatBrPhone("+5521999990000")).toBe("(21) 99999-0000");
    expect(maskPhone("+5521999990077")).toBe("•••• ••77");
  });
});

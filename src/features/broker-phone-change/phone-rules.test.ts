import { describe, expect, it } from "vitest";

import { brazilMobileVariants, formatBrazilMobile, isSameMobile, maskBrazilMobileInput, parseBrazilMobile } from "./phone-rules";

describe("parseBrazilMobile", () => {
  it.each([
    ["(71) 99999-1234", "5571999991234"],
    ["71999991234", "5571999991234"],
    ["+55 71 99999-1234", "5571999991234"],
    ["5571999991234", "5571999991234"],
    ["071 99999-1234", "5571999991234"],
    [" 11 9 8765-4321 ", "5511987654321"],
  ])("normaliza %s para 55 + DDD + 9 dígitos", (raw, phone) => {
    expect(parseBrazilMobile(raw)).toMatchObject({ ok: true, phone });
  });

  it("recusa vazio", () => {
    expect(parseBrazilMobile("")).toEqual({ ok: false, error: "Digite o novo celular com DDD." });
    expect(parseBrazilMobile(undefined)).toMatchObject({ ok: false });
    expect(parseBrazilMobile(12345)).toMatchObject({ ok: false });
  });

  it.each(["7199999123", "719999912345", "99999-1234", "557199999123"])("recusa tamanho errado: %s", (raw) => {
    expect(parseBrazilMobile(raw)).toEqual({ ok: false, error: "O celular precisa ter DDD e 9 dígitos, como (71) 99999-1234." });
  });

  it.each(["(10) 99999-1234", "(20) 99999-1234", "(52) 99999-1234", "(01) 99999-1234"])("recusa DDD que não existe: %s", (raw) => {
    expect(parseBrazilMobile(raw)).toEqual({ ok: false, error: "Esse DDD não existe. Confira os dois primeiros números." });
  });

  it("recusa fixo (sem o 9 depois do DDD)", () => {
    expect(parseBrazilMobile("(71) 39999-1234")).toEqual({ ok: false, error: "O celular começa com 9 depois do DDD." });
  });
});

describe("variações do mesmo celular", () => {
  it("cobre com e sem 55 e com e sem o 9", () => {
    expect(brazilMobileVariants("71999991234")).toEqual(["5571999991234", "71999991234", "557199991234", "7199991234"]);
  });

  it("reconhece o número atual gravado em formato antigo", () => {
    expect(isSameMobile("71999991234", "71999991234")).toBe(true);
    expect(isSameMobile("(71) 9999-1234", "71999991234")).toBe(true);
    expect(isSameMobile("5571999991234", "71999991234")).toBe(true);
    expect(isSameMobile("5571999990000", "71999991234")).toBe(false);
    expect(isSameMobile(null, "71999991234")).toBe(false);
    expect(isSameMobile("", "71999991234")).toBe(false);
  });
});

describe("exibição", () => {
  it("formata o número gravado", () => {
    expect(formatBrazilMobile("5571999991234")).toBe("(71) 99999-1234");
    expect(formatBrazilMobile("71999991234")).toBe("(71) 99999-1234");
    expect(formatBrazilMobile("+1 555 0100")).toBe("+1 555 0100");
  });

  it("mascara enquanto digita e aceita colar com +55", () => {
    expect(maskBrazilMobileInput("7")).toBe("(7");
    expect(maskBrazilMobileInput("7199")).toBe("(71) 99");
    expect(maskBrazilMobileInput("71999991234")).toBe("(71) 99999-1234");
    expect(maskBrazilMobileInput("+55 71 99999-1234")).toBe("(71) 99999-1234");
    expect(maskBrazilMobileInput("719999912345678")).toBe("(71) 99999-1234");
    expect(maskBrazilMobileInput("")).toBe("");
  });
});

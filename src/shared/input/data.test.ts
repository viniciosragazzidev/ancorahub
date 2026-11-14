import { describe, expect, it } from "vitest";

import { dataIso, formatarData, lerData, mascararDataDigitada } from "./data";

const REF = { ano: 2026 };

describe("lerData", () => {
  it.each([
    ["01/02/2026", "2026-02-01"],
    ["1/2/2026", "2026-02-01"],
    ["1/2/26", "2026-02-01"],
    ["01-02-2026", "2026-02-01"],
    ["01.02.2026", "2026-02-01"],
    ["01 02 2026", "2026-02-01"],
    ["1 / 2 / 2026", "2026-02-01"],
    ["01022026", "2026-02-01"],
    ["010226", "2026-02-01"],
    ["2026-02-01", "2026-02-01"],
    ["2026-2-1", "2026-02-01"],
    ["2026/02/01", "2026-02-01"],
    ["2026-02-01T10:00:00.000Z", "2026-02-01"],
    ["  29/02/2024 ", "2024-02-29"],
    ["1/2/85", "1985-02-01"],
    ["1/2/36", "2036-02-01"],
    ["1/2/37", "1937-02-01"],
    ["31/12/1999", "1999-12-31"],
  ])("%s → %s", (entrada, iso) => {
    expect(dataIso(entrada, REF)).toBe(iso);
  });

  it.each([
    ["", "vazio"], [null, "vazio"], ["ontem", "formato"], ["1/2", "formato"], ["2026-02", "formato"], ["1/2/123", "formato"],
    ["31/02/2026", "inexistente"], ["29/02/2025", "inexistente"], ["00/01/2026", "inexistente"], ["10/13/2026", "inexistente"], ["2026-04-31", "inexistente"],
  ] as const)("recusa %s (%s)", (entrada, motivo) => {
    expect(lerData(entrada, REF)).toMatchObject({ ok: false, motivo });
  });

  it("formata para exibir", () => {
    expect(formatarData("2026-02-01")).toBe("01/02/2026");
    expect(formatarData("lixo")).toBe("lixo");
    expect(lerData("1-2-2026", REF)).toEqual({ ok: true, iso: "2026-02-01", exibicao: "01/02/2026" });
  });
});

describe("mascararDataDigitada", () => {
  it("põe as barras enquanto digita", () => {
    expect(["0", "01", "010", "0102", "01022", "010220", "0102202", "01022026", "010220261"].map((t) => mascararDataDigitada(t)))
      .toEqual(["0", "01", "01/0", "01/02", "01/02/2", "01/02/20", "01/02/202", "01/02/2026", "01/02/2026"]);
  });

  it("colar ISO ou data com ano de 4 dígitos vira dd/mm/aaaa", () => {
    expect(mascararDataDigitada("2026-02-01")).toBe("01/02/2026");
    expect(mascararDataDigitada("1/2/2026")).toBe("01/02/2026");
    expect(mascararDataDigitada("1-2-2026")).toBe("01/02/2026");
  });

  it("não atropela quem ainda digita o ano", () => {
    expect(mascararDataDigitada("01/02/20")).toBe("01/02/20");
    expect(mascararDataDigitada("1/2/20")).toBe("01/02/20");
  });

  it("dia ou mês com um dígito e barra ganha o zero", () => {
    expect(mascararDataDigitada("1")).toBe("1");
    expect(mascararDataDigitada("1/")).toBe("01/");
    expect(mascararDataDigitada("01/2/")).toBe("01/02/");
    expect(mascararDataDigitada("01/02/")).toBe("01/02/");
    expect(mascararDataDigitada("01/022")).toBe("01/02/2");
  });
});

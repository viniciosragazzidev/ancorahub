import { describe, expect, it } from "vitest";

import { isValidCpf } from "@/features/leads/sale-details-core";

import { formatarCnpj, formatarCpf, lerCnpj, lerCpf, validarCnpj, validarCpf } from "./documento";

describe("CPF", () => {
  it.each([
    "529.982.247-25", "52998224725", " 529 982 247 25 ", "529.982.247/25", "CPF: 529.982.247-25", "529-982-247-25",
  ])("aceita %s", (entrada) => {
    expect(lerCpf(entrada)).toEqual({ ok: true, digitos: "52998224725", exibicao: "529.982.247-25" });
  });

  it.each([
    ["", "vazio"], [null, "vazio"], ["529.982.247", "tamanho"], ["5299822472512", "tamanho"],
    ["111.111.111-11", "repetido"], ["000.000.000-00", "repetido"], ["529.982.247-26", "digito"], ["529.982.247-35", "digito"],
  ] as const)("recusa %s (%s)", (entrada, motivo) => {
    expect(lerCpf(entrada)).toMatchObject({ ok: false, motivo });
  });

  it("formata progressivamente", () => {
    expect(["5", "529", "5299", "529982", "5299822", "529982247", "5299822472", "52998224725", "529982247251"].map(formatarCpf))
      .toEqual(["5", "529", "529.9", "529.982", "529.982.2", "529.982.247", "529.982.247-2", "529.982.247-25", "529.982.247-25"]);
  });

  it("mesma regra do isValidCpf que a venda já usa (10 mil números)", () => {
    let semente = 7;
    for (let i = 0; i < 10_000; i++) {
      semente = (semente * 1103515245 + 12345) % 2 ** 31;
      const numero = String(semente).padStart(11, "0").slice(-11);
      expect(validarCpf(numero)).toBe(isValidCpf(numero));
    }
    for (const valido of ["52998224725", "11144477735", "39053344705"]) expect(validarCpf(valido)).toBe(true);
  });
});

describe("CNPJ", () => {
  it.each(["11.222.333/0001-81", "11222333000181", "11 222 333 0001 81", "CNPJ 11.222.333/0001-81"])("aceita %s", (entrada) => {
    expect(lerCnpj(entrada)).toEqual({ ok: true, digitos: "11222333000181", exibicao: "11.222.333/0001-81" });
  });

  it.each([
    ["", "vazio"], ["11.222.333/0001", "tamanho"], ["11.111.111/1111-11", "repetido"], ["11.222.333/0001-82", "digito"],
  ] as const)("recusa %s (%s)", (entrada, motivo) => {
    expect(lerCnpj(entrada)).toMatchObject({ ok: false, motivo });
  });

  it("valida CNPJs reais conhecidos", () => {
    expect(validarCnpj("00.000.000/0001-91")).toBe(true); // Banco do Brasil
    expect(validarCnpj("33.000.167/0001-01")).toBe(true); // Petrobras
    expect(validarCnpj("33.000.167/0001-02")).toBe(false);
  });

  it("formata progressivamente", () => {
    expect(["11", "112", "11222", "112223", "11222333", "112223330", "112223330001", "1122233300018", "11222333000181"].map(formatarCnpj))
      .toEqual(["11", "11.2", "11.222", "11.222.3", "11.222.333", "11.222.333/0", "11.222.333/0001", "11.222.333/0001-8", "11.222.333/0001-81"]);
  });
});

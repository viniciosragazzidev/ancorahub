import { describe, expect, it } from "vitest";

import {
  formatarTelefone,
  formatarTelefoneCanal,
  lerTelefone,
  mascararTelefoneDigitado,
  mesmoTelefone,
  normalizarTelefone,
  telefoneCadastroManual,
  telefoneComMais,
} from "./telefone";

describe("lerTelefone: aceita bagunçado", () => {
  it.each([
    ["21999991234", "5521999991234"],
    ["(21) 99999-1234", "5521999991234"],
    ["21 99999 1234", "5521999991234"],
    ["21.99999.1234", "5521999991234"],
    ["+55 21 99999-1234", "5521999991234"],
    ["+55 (21) 99999-1234", "5521999991234"],
    ["+5521999991234", "5521999991234"],
    ["5521999991234", "5521999991234"],
    ["55 21 99999 1234", "5521999991234"],
    ["0055 21 99999-1234", "5521999991234"],
    ["021 99999-1234", "5521999991234"],
    ["(021) 99999-1234", "5521999991234"],
    ["0 15 21 99999-1234", "5521999991234"],
    ["  21999991234  ", "5521999991234"],
    ["tel: 21 99999-1234", "5521999991234"],
    // celular antigo com 8 dígitos ganha o 9
    ["21 9999-1234", "5521999991234"],
    ["(11) 8765-4321", "5511987654321"],
    ["552187654321", "5521987654321"],
    // fixo fica com 8
    ["(21) 2222-3333", "552122223333"],
    ["+55 11 3333-4444", "551133334444"],
    ["1133334444", "551133334444"],
    // DDD 55 (RS) não é confundido com o código do país
    ["(55) 99999-1234", "5555999991234"],
    ["55999991234", "5555999991234"],
  ])("%s → %s", (entrada, esperado) => {
    expect(normalizarTelefone(entrada)).toBe(esperado);
  });

  it("formata para exibir", () => {
    expect(formatarTelefone("+55 21 999991234")).toBe("(21) 99999-1234");
    expect(formatarTelefone("2122223333")).toBe("(21) 2222-3333");
    expect(formatarTelefone("21 8888-7777")).toBe("(21) 98888-7777");
    expect(formatarTelefone("lixo")).toBe("lixo");
    expect(formatarTelefone(null)).toBe("");
  });

  it.each([
    ["", "vazio"],
    [null, "vazio"],
    ["abc", "vazio"],
    ["999991234", "curto"],
    ["21 9999", "curto"],
    ["219999912345", "longo"],
    ["(20) 99999-1234", "ddd"],
    ["(10) 99999-1234", "ddd"],
    ["(21) 89999-1234", "formato"],
    ["(21) 1222-3333", "formato"],
    ["+1 415 555 0100", "internacional"],
    ["00 351 912 345 678", "internacional"],
  ] as const)("%s é inválido (%s) com mensagem", (entrada, motivo) => {
    const lido = lerTelefone(entrada);
    expect(lido.ok).toBe(false);
    if (!lido.ok) {
      expect(lido.motivo).toBe(motivo);
      expect(lido.mensagem.length).toBeGreaterThan(5);
    }
    expect(normalizarTelefone(entrada)).toBeNull();
  });

  it("devolve partes úteis", () => {
    expect(lerTelefone("21 99999-1234")).toEqual({ ok: true, e164: "5521999991234", nacional: "21999991234", ddd: "21", celular: true, exibicao: "(21) 99999-1234" });
    expect(lerTelefone("21 2222-3333")).toMatchObject({ ok: true, celular: false });
  });
});

describe("mesmoTelefone", () => {
  it("compara pelos 8 últimos dígitos, com ou sem 55 e formatação", () => {
    expect(mesmoTelefone("+55 21 99999-1234", "21999991234")).toBe(true);
    expect(mesmoTelefone("552199991234", "21999991234")).toBe(true);
    expect(mesmoTelefone("21999991234", "21999991235")).toBe(false);
    expect(mesmoTelefone("1234", "1234")).toBe(false);
    expect(mesmoTelefone(null, "21999991234")).toBe(false);
  });
});

describe("mascararTelefoneDigitado", () => {
  it("formata progressivamente enquanto digita", () => {
    const passos = "21999991234".split("").map((_, i) => mascararTelefoneDigitado("21999991234".slice(0, i + 1)));
    expect(passos).toEqual([
      "(2", "(21", "(21) 9", "(21) 99", "(21) 999", "(21) 9999", "(21) 9999-9", "(21) 9999-91", "(21) 9999-912", "(21) 9999-9123", "(21) 99999-1234",
    ]);
  });

  it.each([
    ["+55 21 99999-1234", "+55 (21) 99999-1234"],
    ["5521999991234", "(21) 99999-1234"],
    ["021999991234", "(21) 99999-1234"],
    ["(21)99999-1234", "(21) 99999-1234"],
    ["21 2222 3333", "(21) 2222-3333"],
    ["2199999123499", "(21) 99999-1234"],
    ["", ""],
    ["+", "+"],
    ["+5", "+5"],
    ["+55", "+55"],
    ["+552", "+55 (2"],
    ["+1 415", "+1415"],
    ["02", "02"],
  ])("colar %s vira %s", (entrada, esperado) => {
    expect(mascararTelefoneDigitado(entrada)).toBe(esperado);
  });

  it("o que a máscara mostra continua gravando igual no cadastro manual (dígitos → telefoneCadastroManual)", () => {
    const entradas = ["21999991234", "+55 21 99999-1234", "5521999991234", "(21) 2222-3333", "21 9999-1234", "552133334444", "(55) 99999-1234"];
    for (const entrada of entradas) {
      const mostrado = mascararTelefoneDigitado(entrada);
      expect(telefoneCadastroManual(mostrado.replace(/\D/g, ""))).toBe(telefoneCadastroManual(entrada));
    }
  });
});

// ─── Equivalência com as cópias antigas (nada que grava pode mudar) ─────────────────────────────────────────

/** Cópia literal de features/leads/manual-create.ts antes da troca. */
function antigoManualCreate(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (digits.length === 10) {
    digits = `${digits.slice(0, 2)}9${digits.slice(2)}`;
  }
  return `55${digits}`;
}

/** Cópia literal de features/browser-extension/schemas.ts antes da troca. */
function antigoExtensao(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  return `+${digits}`;
}

/** Cópia literal do tenant-channel-card.tsx antes da troca. */
function antigoCanal(digits: string | null) {
  if (!digits) return null;
  const national = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (national.length === 11) return `+55 (${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  if (national.length === 10) return `+55 (${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  return `+${digits}`;
}

/** Os três formatos reais de leads.telefone em produção, mais lixo de borda. */
const REAIS = [
  "+5521999991234", "+552122223333", "+5511987654321", "+551133334444",
  "5521999991234", "552122223333", "5511987654321", "552187654321",
  "21999991234", "2122223333", "11987654321", "2187654321",
  "(21) 99999-1234", "+55 (21) 99999-1234", "021 99999-1234", "0055 21 99999 1234",
  "", "   ", "abc", "123", "999991234", "+1 415 555 0100", "00351912345678", "55", "5555999991234", "55999991234",
];

/** Gerador determinístico de telefones bagunçados (sem Math.random, o teste é sempre igual). */
function bagunçados(quantos: number) {
  let semente = 20261114;
  const proximo = () => (semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const separadores = ["", " ", "-", ".", "(", ")", "+", "/", "  "];
  const saida: string[] = [];
  for (let i = 0; i < quantos; i++) {
    const tamanho = 6 + Math.floor(proximo() * 10);
    let texto = "";
    for (let j = 0; j < tamanho; j++) {
      if (proximo() < 0.25) texto += separadores[Math.floor(proximo() * separadores.length)];
      texto += Math.floor(proximo() * 10);
    }
    saida.push(texto);
  }
  return saida;
}

describe("equivalência: funções legado == cópias antigas", () => {
  const todas = [...REAIS, ...bagunçados(3000)];

  it("telefoneCadastroManual == normalizePhone antigo do cadastro manual", () => {
    for (const entrada of todas) expect(telefoneCadastroManual(entrada)).toBe(antigoManualCreate(entrada));
  });

  it("telefoneComMais == normalizePhone antigo da extensão", () => {
    for (const entrada of todas) expect(telefoneComMais(entrada)).toBe(antigoExtensao(entrada));
  });

  it("formatarTelefoneCanal == formatPhone antigo do canal da corretora", () => {
    expect(formatarTelefoneCanal(null)).toBe(antigoCanal(null));
    for (const entrada of todas) {
      const digitos = entrada.replace(/\D/g, "");
      expect(formatarTelefoneCanal(digitos)).toBe(antigoCanal(digitos));
    }
  });
});

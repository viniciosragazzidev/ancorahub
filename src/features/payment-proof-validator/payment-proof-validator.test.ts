import { describe, expect, it } from "vitest";

import { dueDateFromFator, findLinhasDigitaveis, mod10, mod11Bancario, parseLinhaDigitavel } from "./boleto";
import { maskedDocumentMatches } from "./documents";
import { validatePaymentProof } from "./rules";
import type { ProofExtraction, ProposalExtraction } from "./types";

/** Monta uma linha digitável bancária válida, como a operadora emitiria. */
function buildLinha({ bank = "341", fator, cents, campoLivre = "1234567890123456789012345" }: {
  bank?: string;
  fator: number;
  cents: number;
  campoLivre?: string;
}) {
  const fatorStr = String(fator).padStart(4, "0");
  const valor = String(cents).padStart(10, "0");
  const head = `${bank}9`;
  const dv = mod11Bancario(head + fatorStr + valor + campoLivre);
  const f1 = head + campoLivre.slice(0, 5);
  const f2 = campoLivre.slice(5, 15);
  const f3 = campoLivre.slice(15, 25);
  return `${f1}${mod10(f1)}${f2}${mod10(f2)}${f3}${mod10(f3)}${dv}${fatorStr}${valor}`;
}

function fatorFor(isoDate: string) {
  const days = Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.UTC(1997, 9, 7)) / 86_400_000);
  return days > 9999 ? days - 9000 : days;
}

// Caso real: proposta Amil PME 97338755 e comprovante 99Pay de 19/10/2026.
const proposal: ProposalExtraction = {
  operadora: "Amil",
  numeroProposta: "97338755",
  valorTotal: 535.98,
  titular: { nome: "Tais Pereira Pimenta", documento: "15696743706" },
  empresa: { razaoSocial: "Tais Pereira Pimenta", cnpj: "63572790000108" },
  responsavelLegal: { nome: "Tais Pereira Pimenta", documento: "15696743706" },
  emailContato: "jonathan.comerciall01@gmail.com",
  telefoneContato: "21981574805",
  corretor: { nome: "Jonathan Almeida de Souza", documento: "15922888714", email: null },
};

const proof: ProofExtraction = {
  instituicao: "99Pay",
  status: "Concluído",
  valor: 535.98,
  dataPagamento: "2026-10-19",
  vencimento: "2026-11-09",
  beneficiarioNome: "AMIL ASSISTENCIA ME",
  beneficiarioDocumento: "**.*09.127/0001-**",
  pagadorNome: "TAIS ******* *******",
  pagadorDocumento: "***967437**",
  linhaDigitavel: null,
};

describe("linha digitável", () => {
  it("aceita uma linha válida e lê valor e vencimento", () => {
    const linha = buildLinha({ fator: fatorFor("2026-11-09"), cents: 53598 });
    const parsed = parseLinhaDigitavel(linha, new Date("2026-10-19T12:00:00Z"));
    expect(parsed).toMatchObject({ kind: "bancario", valid: true, amount: 535.98, dueDate: "2026-11-09", bankCode: "341" });
  });

  it("recusa linha com um dígito trocado", () => {
    const linha = buildLinha({ fator: fatorFor("2026-11-09"), cents: 53598 });
    const tampered = `${linha.slice(0, 40)}${linha[40] === "9" ? "8" : "9"}${linha.slice(41)}`;
    expect(parseLinhaDigitavel(tampered)?.valid).toBe(false);
  });

  it("usa o ciclo novo do fator de vencimento", () => {
    expect(dueDateFromFator(1000, new Date("2026-01-01"))).toBe("2025-02-22");
    expect(dueDateFromFator(0)).toBeNull();
  });

  it("encontra a linha num texto com pontos e espaços", () => {
    const linha = buildLinha({ fator: fatorFor("2026-11-09"), cents: 53598 });
    const formatted = `${linha.slice(0, 5)}.${linha.slice(5, 10)} ${linha.slice(10, 15)}.${linha.slice(15, 21)} ${linha.slice(21, 26)}.${linha.slice(26, 32)} ${linha[32]} ${linha.slice(33)}`;
    const found = findLinhasDigitaveis(`Pagamento\nLinha: ${formatted}\nValor R$ 535,98`);
    expect(found[0]?.digits).toBe(linha);
  });
});

describe("documento mascarado", () => {
  it("confere CPF e CNPJ parciais", () => {
    expect(maskedDocumentMatches("***967437**", "156.967.437-06")).toBe(true);
    expect(maskedDocumentMatches("**.*09.127/0001-**", "29.309.127/0001-79")).toBe(true);
    expect(maskedDocumentMatches("***111222**", "15696743706")).toBe(false);
    expect(maskedDocumentMatches("***.***.***-**", "15696743706")).toBeNull();
  });
});

describe("validatePaymentProof", () => {
  it("caso real: coerente, mas pede revisão (sem linha digitável e e-mail do corretor)", () => {
    const result = validatePaymentProof({ proposal, proof });
    const byId = Object.fromEntries(result.checks.map((check) => [check.id, check.status]));
    expect(result.verdict).toBe("revisar");
    expect(byId).toMatchObject({
      valor: "ok",
      status: "ok",
      beneficiario: "ok",
      pagador: "ok",
      "linha-presente": "warn",
      boleto: "skip",
      contato: "warn",
      data: "ok",
    });
  });

  it("aprova quando o boleto original e a linha batem e o contato é do cliente", () => {
    const linha = buildLinha({ fator: fatorFor("2026-11-09"), cents: 53598 });
    const result = validatePaymentProof({
      proposal: { ...proposal, emailContato: "tais.pimenta@gmail.com" },
      proof: { ...proof, linhaDigitavel: linha },
      boleto: {
        valor: 535.98,
        vencimento: "2026-11-09",
        beneficiarioNome: "Amil Assistência Médica Internacional S.A.",
        beneficiarioCnpj: "29.309.127/0001-79",
        pagadorNome: "Tais Pereira Pimenta",
        pagadorDocumento: "63.572.790/0001-08",
        linhaDigitavel: linha,
      },
    });
    expect(result.checks.filter((check) => check.status !== "ok")).toEqual([]);
    expect(result.verdict).toBe("aprovavel");
  });

  it("recusa valor diferente, agendamento e pagamento feito pelo corretor", () => {
    const result = validatePaymentProof({
      proposal,
      proof: { ...proof, valor: 335.98, status: "Agendado", pagadorDocumento: "***228887**" },
    });
    const failed = result.checks.filter((check) => check.status === "fail").map((check) => check.id);
    expect(result.verdict).toBe("recusar");
    expect(failed).toEqual(expect.arrayContaining(["valor", "status", "pagador"]));
  });

  it("recusa comprovante de outro boleto", () => {
    const linhaPaga = buildLinha({ fator: fatorFor("2026-11-09"), cents: 53598, campoLivre: "9999999999999999999999999" });
    const linhaBoleto = buildLinha({ fator: fatorFor("2026-11-09"), cents: 53598 });
    const result = validatePaymentProof({
      proposal,
      proof: { ...proof, linhaDigitavel: linhaPaga },
      boleto: {
        valor: 535.98,
        vencimento: "2026-11-09",
        beneficiarioNome: "Amil",
        beneficiarioCnpj: "29309127000179",
        pagadorNome: null,
        pagadorDocumento: null,
        linhaDigitavel: linhaBoleto,
      },
    });
    expect(result.checks.find((check) => check.id === "linha-boleto")?.status).toBe("fail");
    expect(result.verdict).toBe("recusar");
  });

  it("recusa beneficiário que não é a operadora", () => {
    const result = validatePaymentProof({
      proposal,
      proof: { ...proof, beneficiarioNome: "JOAO DA SILVA", beneficiarioDocumento: "***123456**" },
    });
    expect(result.checks.find((check) => check.id === "beneficiario")?.status).toBe("fail");
  });
});

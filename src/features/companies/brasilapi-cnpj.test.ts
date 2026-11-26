import { beforeEach, describe, expect, it, vi } from "vitest";

import fixture from "./__fixtures__/brasilapi-cnpj.json";
import { cnpjSituationWarning, formatCnae, mapBrasilApiCnpj, sizeLabel, titleCasePlace } from "./brasilapi-cnpj";
import { clearCnpjLookupCache, lookupCnpj } from "./cnpj-lookup";

describe("mapBrasilApiCnpj", () => {
  it("maps the BrasilAPI response to the company facts, without partners or contacts", () => {
    const data = mapBrasilApiCnpj(fixture);
    expect(data).toEqual({
      cnpj: "00.000.000/0001-91",
      legalName: "BANCO DO BRASIL SA",
      tradeName: "DIRECAO GERAL",
      situation: "ATIVA",
      situationLabel: "Ativa",
      active: true,
      cnae: "6422-1/00 Bancos múltiplos, com carteira comercial",
      city: "Brasilia/DF",
      size: "Médio ou grande porte",
      openedAt: "1966-08-01",
    });
    expect(JSON.stringify(data)).not.toContain("SOCIO");
    expect(JSON.stringify(data)).not.toContain("6134939002");
  });

  it("marks an inactive CNPJ and refuses an incomplete answer", () => {
    const data = mapBrasilApiCnpj({ ...fixture, descricao_situacao_cadastral: "BAIXADA" });
    expect(data?.active).toBe(false);
    expect(data?.situationLabel).toBe("Baixada");
    expect(mapBrasilApiCnpj({ ...fixture, razao_social: "" })).toBeNull();
    expect(mapBrasilApiCnpj(null)).toBeNull();
    expect(mapBrasilApiCnpj({ ...fixture, cnpj: "123" })).toBeNull();
  });

  it("formats CNAE, size and place", () => {
    expect(formatCnae(6201501)).toBe("6201-5/01");
    expect(sizeLabel("MICRO EMPRESA")).toBe("Microempresa");
    expect(sizeLabel("EMPRESA DE PEQUENO PORTE")).toBe("Empresa de pequeno porte");
    expect(sizeLabel(null)).toBe("Não informado");
    expect(titleCasePlace("SAO JOSE DOS CAMPOS")).toBe("Sao Jose dos Campos");
  });
});

describe("cnpjSituationWarning", () => {
  it("warns only when the CNPJ is not active", () => {
    expect(cnpjSituationWarning("ATIVA")).toBeNull();
    expect(cnpjSituationWarning("ativa")).toBeNull();
    for (const situation of ["BAIXADA", "INAPTA", "SUSPENSA", "NULA", null]) {
      expect(cnpjSituationWarning(situation)).toBe("CNPJ não está ativo: a operadora não aceita contrato PME.");
    }
  });
});

describe("lookupCnpj", () => {
  beforeEach(() => clearCnpjLookupCache());

  const ok = () => new Response(JSON.stringify(fixture), { status: 200, headers: { "Content-Type": "application/json" } });

  it("does not call the API for an invalid CNPJ", async () => {
    const fetchImpl = vi.fn();
    const result = await lookupCnpj("00.000.000/0001-92", { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({ ok: false, reason: "CNPJ inválido: os dígitos verificadores não conferem.", retryable: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends only the CNPJ digits and caches by CNPJ", async () => {
    const fetchImpl = vi.fn(async (_url: string) => ok());
    const first = await lookupCnpj("00.000.000/0001-91", { fetchImpl: fetchImpl as unknown as typeof fetch });
    const second = await lookupCnpj("00000000000191", { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(first.ok && first.data.legalName).toBe("BANCO DO BRASIL SA");
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://brasilapi.com.br/api/cnpj/v1/00000000000191");
  });

  it("explains not found, rate limit and timeout", async () => {
    const notFound = await lookupCnpj("11.222.333/0001-81", { fetchImpl: (async () => new Response("{}", { status: 404 })) as typeof fetch });
    expect(notFound).toMatchObject({ ok: false, retryable: false });
    clearCnpjLookupCache();
    const limited = await lookupCnpj("11.222.333/0001-81", { fetchImpl: (async () => new Response("{}", { status: 429 })) as typeof fetch });
    expect(limited).toMatchObject({ ok: false, retryable: true });
    const slow: typeof fetch = (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });
    const timedOut = await lookupCnpj("11.222.333/0001-81", { fetchImpl: slow, timeoutMs: 10 });
    expect(timedOut).toEqual({ ok: false, reason: "A consulta de CNPJ demorou demais.", retryable: true });
  });
});

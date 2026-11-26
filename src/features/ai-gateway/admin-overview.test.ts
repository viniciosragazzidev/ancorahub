import { describe, expect, it } from "vitest";

import {
  aggregateUsage,
  credentialBadge,
  maskApiKey,
  profileFallback,
  readProviderCheck,
  shortFailureCause,
  usageGroupCostUsd,
  usageTotals,
  type UsageGroupRow,
} from "./admin-overview";

describe("mascaramento da chave", () => {
  it("mostra só os 4 últimos caracteres", () => {
    const key = "sk-ant-api03-abcdefghijklmnopWXYZ";
    const masked = maskApiKey(key);
    expect(masked).toBe("•••• WXYZ");
    expect(masked).not.toContain("sk-ant");
  });

  it("chave curta não mostra nada dela e sem chave volta nulo", () => {
    expect(maskApiKey("abc12345")).toBe("••••");
    expect(maskApiKey("   ")).toBeNull();
    expect(maskApiKey(null)).toBeNull();
  });
});

describe("selo de validação", () => {
  const key = "gsk_0123456789abcd";
  const at = "2026-11-26T12:00:00.000Z";

  it("sem teste é Não testada", () => {
    expect(credentialBadge({ key, check: null })).toEqual({ tone: undefined, label: "Não testada" });
  });

  it("teste certo é Validada", () => {
    expect(credentialBadge({ key, check: { ok: true, at, last4: "abcd" } })).toEqual({ tone: "success", label: "Validada" });
  });

  it("teste com falha traz a causa curta", () => {
    expect(credentialBadge({ key, check: { ok: false, cause: "chave recusada", at, last4: "abcd" } })).toEqual({ tone: "danger", label: "Falhou: chave recusada" });
  });

  it("chave trocada depois do teste volta a Não testada", () => {
    expect(credentialBadge({ key, check: { ok: true, at, last4: "zzzz" } }).label).toBe("Não testada");
  });

  it("sem chave", () => {
    expect(credentialBadge({ key: null, check: null }).label).toBe("Sem chave");
  });

  it("causa curta por status e erro de rede", () => {
    expect(shortFailureCause({ status: 401 })).toBe("chave recusada");
    expect(shortFailureCause({ status: 402 })).toBe("sem crédito");
    expect(shortFailureCause({ status: 429 })).toBe("limite de uso");
    expect(shortFailureCause({ status: 503 })).toBe("provedor fora do ar");
    const timeout = new Error("t");
    timeout.name = "TimeoutError";
    expect(shortFailureCause({ error: timeout })).toBe("sem resposta");
    expect(shortFailureCause({ error: new TypeError("fetch failed") })).toBe("sem conexão");
  });

  it("lê o resultado salvo e ignora valor inválido", () => {
    expect(readProviderCheck(JSON.stringify({ ok: true, at, last4: "abcd" }))).toEqual({ ok: true, at, last4: "abcd", cause: undefined });
    expect(readProviderCheck("{")).toBeNull();
    expect(readProviderCheck(JSON.stringify({ ok: "sim" }))).toBeNull();
  });
});

describe("reserva por perfil", () => {
  it("segundo da cadeia é a reserva; sem segundo, Sem reserva", () => {
    expect(profileFallback([{ provider: "anthropic", model: "claude-haiku-5-5" }, { provider: "openrouter", model: "openai/gpt-oss-120b" }]))
      .toEqual({ primary: "Anthropic · claude-haiku-5-5", fallback: "Se falhar: OpenRouter · openai/gpt-oss-120b" });
    expect(profileFallback([{ provider: "groq", model: "openai/gpt-oss-20b" }]).fallback).toBe("Sem reserva");
    expect(profileFallback([]).primary).toBe("Sem provedor com chave");
  });
});

describe("agregação de custo", () => {
  const base: Omit<UsageGroupRow, "purpose" | "model"> = {
    tenantId: "t1", tenantName: "Âncora", calls: 0, tokens: 0, reportedCostUsd: 0, unpricedInputTokens: 0, unpricedOutputTokens: 0,
  };

  it("Claude sem custo informado entra a preço de tabela; custo informado soma direto", () => {
    expect(usageGroupCostUsd({ model: "anthropic/claude-haiku-5-5", reportedCostUsd: 0, unpricedInputTokens: 1_000_000, unpricedOutputTokens: 1_000_000 })).toBeCloseTo(0.6);
    expect(usageGroupCostUsd({ model: "anthropic/claude-haiku-5.5", reportedCostUsd: 0.25, unpricedInputTokens: 0, unpricedOutputTokens: 0 })).toBeCloseTo(0.25);
    expect(usageGroupCostUsd({ model: "openai/gpt-oss-20b", reportedCostUsd: 0, unpricedInputTokens: 5000, unpricedOutputTokens: 5000 })).toBe(0);
  });

  it("soma por empresa e tipo de uso, junta modelos, ignora regra determinística e ordena por custo", () => {
    const rows = aggregateUsage([
      { ...base, purpose: "sasa_agent", model: "anthropic/claude-haiku-5-5", calls: 10, tokens: 2000, unpricedInputTokens: 1_000_000, unpricedOutputTokens: 0 },
      { ...base, purpose: "sasa_agent", model: "openrouter/x", calls: 5, tokens: 500, reportedCostUsd: 0.5 },
      { ...base, purpose: "lateral_answer", model: "anthropic/claude-haiku-5-5", calls: 3, tokens: 300 },
      { ...base, purpose: "deterministic_qualification", model: "qualification_rules_v1", calls: 99, tokens: 0 },
      { ...base, tenantId: "t2", tenantName: null, purpose: "sasa_agent", model: "groq/x", calls: 1, tokens: 10 },
    ]);
    expect(rows.map((row) => row.id)).toEqual(["t1:sasa_agent", "t1:lateral_answer", "t2:sasa_agent"]);
    expect(rows[0]).toMatchObject({ purposeLabel: "Sasá", calls: 15, tokens: 2500 });
    expect(rows[0].costUsd).toBeCloseTo(0.6);
    expect(rows[2].tenantName).toBe("Empresa sem nome");
    expect(usageTotals(rows)).toMatchObject({ calls: 19, tokens: 2810 });
  });
});

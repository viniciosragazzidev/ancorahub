import { describe, expect, it } from "vitest";

import { aiRunStatusView, classifyAiRunError, explainAiRun, formatAiRunLatency, isAiRunFailure, summarizeAiRuns } from "./ai-runs-copy";

describe("tradução dos erros da IA", () => {
  it.each([
    ["OpenRouter HTTP 429: Rate limit exceeded", "rate_limit"],
    ["Too Many Requests", "rate_limit"],
    ["insufficient_credits for this request", "rate_limit"],
    ["Request timed out after 30000ms", "timeout"],
    ["AbortError: The operation was aborted", "timeout"],
    ["ETIMEDOUT", "timeout"],
    ["HTTP 401: No auth credentials found", "invalid_key"],
    ["Invalid API key provided", "invalid_key"],
    ["Unauthorized", "invalid_key"],
    ["The response was filtered due to the prompt triggering content management policy", "content_refused"],
    ["Resposta bloqueada pelo guardrail promise: promessa", "content_refused"],
    ["WAHA session is not connected", "whatsapp_disconnected"],
    ["WhatsApp send failed: 403 session STOPPED", "whatsapp_disconnected"],
    ["SCAN_QR_CODE", "whatsapp_disconnected"],
    ["HTTP 500 Internal Server Error", "provider"],
    ["", "provider"],
  ])("%s vira %s", (message, kind) => {
    expect(classifyAiRunError(message)).toBe(kind);
  });

  it("sem texto reconhecível cai em Erro do provedor", () => {
    expect(explainAiRun({ status: "failed", errorMessage: "algo estranho" })).toMatchObject({ kind: "provider", title: "Erro do provedor" });
    expect(explainAiRun({ status: "failed", errorMessage: null }).title).toBe("Erro do provedor");
  });

  it("explica com o que fazer e a tela certa", () => {
    const whatsapp = explainAiRun({ status: "failed", errorMessage: "waha session disconnected" });
    expect(whatsapp).toMatchObject({ title: "WhatsApp desconectado", href: "/qualificacao?tab=whatsapp_diag" });
    expect(whatsapp.whatToDo).toContain("Reconecte");
    expect(explainAiRun({ status: "failed", errorMessage: "429" }).title).toBe("Limite do provedor");
    expect(explainAiRun({ status: "failed", errorMessage: "timeout" }).href).toBe("/qualificacao/leads");
  });

  it("não entregue sem texto é o WhatsApp; resposta reserva avisa que o cliente foi atendido", () => {
    expect(explainAiRun({ status: "delivery_failed", errorMessage: null }).kind).toBe("whatsapp_disconnected");
    const fallback = explainAiRun({ status: "fallback", errorMessage: "HTTP 429" });
    expect(fallback.title).toBe("Resposta reserva: limite do provedor");
    expect(fallback.whatToDo).toMatch(/^O cliente recebeu a resposta pronta/);
  });

  it("sucesso não tem erro para explicar", () => {
    expect(explainAiRun({ status: "success", errorMessage: null })).toMatchObject({ kind: "none", whatToDo: "Nada a fazer." });
  });

  it("nenhum texto usa travessão", () => {
    for (const status of ["failed", "fallback", "delivery_failed"]) {
      for (const message of ["429", "timeout", "401", "content_filter", "waha", "x"]) {
        const view = explainAiRun({ status, errorMessage: message });
        expect(`${view.title} ${view.whatToDo}`).not.toContain("—");
      }
    }
  });
});

describe("resumo e situação das execuções", () => {
  it("resume as últimas 24 h", () => {
    expect(summarizeAiRuns(0, 0)).toBe("Nenhuma execução nas últimas 24 h");
    expect(summarizeAiRuns(40, 0)).toBe("Nenhuma falha nas últimas 24 h");
    expect(summarizeAiRuns(40, 1)).toBe("1 de 40 falhou nas últimas 24 h");
    expect(summarizeAiRuns(1200, 3)).toBe("3 de 1.200 falharam nas últimas 24 h");
  });

  it("situação sempre com texto; resposta reserva não conta como falha", () => {
    expect(aiRunStatusView("success")).toEqual({ label: "Respondeu", tone: "success" });
    expect(aiRunStatusView("failed")).toEqual({ label: "Falhou", tone: "danger" });
    expect(aiRunStatusView("fallback").label).toBe("Resposta reserva");
    expect(aiRunStatusView("delivery_failed").label).toBe("Não entregue");
    expect(isAiRunFailure("failed")).toBe(true);
    expect(isAiRunFailure("delivery_failed")).toBe(true);
    expect(isAiRunFailure("fallback")).toBe(false);
  });

  it("formata o tempo", () => {
    expect(formatAiRunLatency(0)).toBe("Sem medida");
    expect(formatAiRunLatency(850)).toBe("850 ms");
    expect(formatAiRunLatency(2400)).toBe("2,4 s");
  });
});

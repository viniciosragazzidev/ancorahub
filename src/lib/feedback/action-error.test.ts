import { describe, expect, it } from "vitest";

import { DEFAULT_ACTION_ERROR, actionErrorMessage, isFailedResult, normalizeActionError } from "./action-error";

describe("normalizeActionError", () => {
  it("reads the three action result shapes", () => {
    expect(normalizeActionError({ ok: false, reason: "Este lead já foi aceito por outro corretor" }).cause).toBe("Este lead já foi aceito por outro corretor.");
    expect(normalizeActionError({ ok: false, error: "Sem permissão para esta unidade." }).cause).toBe("Sem permissão para esta unidade.");
    expect(normalizeActionError({ ok: false, message: "fila pausada" }).cause).toBe("Fila pausada.");
  });

  it("never shows technical or English text", () => {
    expect(normalizeActionError(new TypeError("Cannot read properties of undefined (reading 'id')")).cause).toBe(DEFAULT_ACTION_ERROR);
    expect(normalizeActionError({ ok: false, error: "Internal server error" }).cause).toBe(DEFAULT_ACTION_ERROR);
    expect(normalizeActionError("duplicate key value violates constraint {lead_pkey}").cause).toBe(DEFAULT_ACTION_ERROR);
  });

  it("names a lost connection", () => {
    expect(normalizeActionError(new TypeError("Failed to fetch"))).toEqual({ cause: "Sem conexão agora.", retryable: true });
  });

  it("uses the fallback when there is no text and keeps retryable false when the action says so", () => {
    expect(normalizeActionError(null, "Não consegui aceitar agora").cause).toBe("Não consegui aceitar agora.");
    expect(normalizeActionError({ ok: false, reason: "Lead encerrado.", retryable: false }).retryable).toBe(false);
  });

  it("adds what still holds after the cause", () => {
    expect(actionErrorMessage({ cause: "O aceite não foi registrado.", retryable: true }, "O lead continua esperando você")).toBe("O aceite não foi registrado. O lead continua esperando você.");
  });

  it("detects failed results", () => {
    expect(isFailedResult({ ok: false })).toBe(true);
    expect(isFailedResult({ ok: true })).toBe(false);
    expect(isFailedResult(undefined)).toBe(false);
  });
});

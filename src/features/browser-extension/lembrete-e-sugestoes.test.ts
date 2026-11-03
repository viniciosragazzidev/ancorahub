import { describe, expect, it, vi } from "vitest";
import { resolverQuandoLembrete } from "../../../src/features/leads/lembrete-servico";
import { sugestoesDoRoteiro } from "./sugestoes";

vi.mock("@/shared/db", () => ({ schema: {}, getDatabase: () => ({}) }));

// 10:00 em São Paulo (13:00 UTC) de uma quarta-feira, dados fixos.
const AGORA = new Date("2026-11-04T13:00:00.000Z");

describe("presets do lembrete (fuso de São Paulo)", () => {
  it("hoje vira 18h de São Paulo (21h UTC)", () => {
    expect(resolverQuandoLembrete("today", AGORA).toISOString()).toBe("2026-11-04T21:00:00.000Z");
  });

  it("amanhã vira 9h de São Paulo do dia seguinte (12h UTC)", () => {
    expect(resolverQuandoLembrete("tomorrow", AGORA).toISOString()).toBe("2026-11-05T12:00:00.000Z");
  });

  it("data escolhida no passado é recusada", () => {
    expect(() => resolverQuandoLembrete("2026-11-01T12:00:00.000Z", AGORA)).toThrow("Essa data já passou");
  });

  it("data inválida é recusada", () => {
    expect(() => resolverQuandoLembrete("não é data", AGORA)).toThrow("Data invalida.");
  });

  it("um prazo que já passou hoje vira 1 hora a partir de agora (não nasce atrasado)", () => {
    const tarde = new Date("2026-11-04T23:30:00.000Z");
    const prazo = resolverQuandoLembrete("today", tarde);
    expect(prazo.getTime()).toBe(tarde.getTime() + 60 * 60_000);
  });
});

describe("sugestões do roteiro (determinísticas, sem IA)", () => {
  const contexto = { nome: "Cliente Exemplo da Silva", etapa: "in_contact", qualificado: false };

  it("é determinística: mesmo objetivo e contexto, mesmo texto", () => {
    expect(sugestoesDoRoteiro("ASK_MISSING_FIELD", contexto)).toEqual(sugestoesDoRoteiro("ASK_MISSING_FIELD", contexto));
  });

  it("usa só o primeiro nome e nunca traz telefone, CPF ou preço", () => {
    const textos = sugestoesDoRoteiro("ASK_MISSING_FIELD", contexto).map((item) => item.text).join(" ");
    expect(textos).toContain("Cliente");
    expect(textos).not.toContain("da Silva");
    expect(textos).not.toMatch(/\d{3}\.\d{3}|\(\d{2}\)|R\$/);
  });

  it("lead qualificado não pede dado de novo", () => {
    const textos = sugestoesDoRoteiro("ASK_MISSING_FIELD", { ...contexto, qualificado: true }).map((item) => item.text).join(" ");
    expect(textos).not.toMatch(/pode me contar/);
  });

  it("cada objetivo devolve duas opções, uma direta e outra consultiva", () => {
    const opcoes = sugestoesDoRoteiro("FOLLOW_UP", contexto);
    expect(opcoes.map((item) => item.tone)).toEqual(["DIRECT", "CONSULTATIVE"]);
  });
});

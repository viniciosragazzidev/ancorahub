// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/db", () => ({ schema: {}, getDatabase: () => ({}) }));
import { extensionQualificationThreadSchema } from "./qualification-thread-schema";
import { HistoricoQualificacao } from "../../../apps/browser-extension/src/panel/historico-qualificacao";

const leadId = "11111111-1111-4111-8111-111111111111";
const mensagem = { de: "qualificacao" as const, texto: "Olá, sou da qualificação", horario: "2026-11-03T18:12:23.000Z" };

describe("conversa da qualificação na extensão (payload fechado)", () => {
  it("aceita só leadId, total e mensagens de texto com direção e horário", () => {
    const ok = extensionQualificationThreadSchema.parse({ leadId, total: 1, mensagens: [mensagem] });
    expect(ok.mensagens[0]).toEqual(mensagem);
  });

  it("recusa campos fora da allowlist (nota interna, telefone, anexo)", () => {
    expect(() => extensionQualificationThreadSchema.parse({ leadId, total: 1, mensagens: [{ ...mensagem, notaInterna: "x" }] })).toThrow();
    expect(() => extensionQualificationThreadSchema.parse({ leadId, total: 1, mensagens: [], telefone: "5561999999999" })).toThrow();
    expect(() => extensionQualificationThreadSchema.parse({ leadId, total: 1, mensagens: [{ ...mensagem, mediaKind: "image" }] })).toThrow();
  });

  it("direção só 'cliente' ou 'qualificacao'", () => {
    expect(() => extensionQualificationThreadSchema.parse({ leadId, total: 1, mensagens: [{ ...mensagem, de: "corretor" }] })).toThrow();
  });
});

describe("histórico recolhido dentro da conversa", () => {
  afterEach(cleanup);

  it("recolhido por padrão, com o total e a origem explícita", () => {
    render(<HistoricoQualificacao historico={{ total: 2, mensagens: [mensagem] }} />);
    expect(screen.getByRole("button", { name: /Ver conversa da qualificação \(2 mensagens\)/ })).toBeTruthy();
    expect(screen.getByText(/não é desta conversa/)).toBeTruthy();
    expect(screen.queryByText("Olá, sou da qualificação")).toBeNull();
  });

  it("expande e mostra as bolhas com o texto", () => {
    render(<HistoricoQualificacao historico={{ total: 1, mensagens: [mensagem] }} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver conversa da qualificação/ }));
    expect(screen.getByText("Olá, sou da qualificação")).toBeTruthy();
  });
});

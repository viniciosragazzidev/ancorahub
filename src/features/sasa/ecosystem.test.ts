import { describe, expect, it } from "vitest";

import { LAB_SASA_QUESTIONS, labSasaAnswer, labSasaWorld } from "@/app/dev/laboratorio/sasa-lab";

import { areasOf, looksLikeQuestion } from "./ecosystem-areas";
import { classifySasaText } from "./intent-rules";

describe("perguntas sobre o ecossistema do corretor", () => {
  it.each(LAB_SASA_QUESTIONS.filter(([area]) => area !== "lead"))("%s: a pergunta pronta pede a área certa", (area, question) => {
    expect(areasOf(question)).toContain(area);
  });

  it("pergunta com nome de lead lê o lead", () => {
    const [answer] = labSasaAnswer("O que a Ana Souza já falou comigo?", labSasaWorld(new Date("2026-11-19T14:00:00-03:00")));
    expect(answer).toMatchObject({ type: "assistant", text: expect.stringContaining("Um lead") });
  });

  it("sem palavra conhecida, a IA escolhe as fontes", () => {
    expect(areasOf("me ajuda a organizar a semana")).toEqual([]);
  });

  it("reconhece pergunta", () => {
    expect(looksLikeQuestion("quantas vendas eu fiz")).toBe(true);
    expect(looksLikeQuestion("O que a Ana disse?")).toBe(true);
    expect(looksLikeQuestion("a Ana disse que vai pensar")).toBe(false);
  });
});

describe("pergunta nunca escreve", () => {
  it.each([
    "O que a Ana disse?",
    "Quantas vendas eu fechei este mês?",
    "Quantos leads eu tenho em negociação?",
    "Quais cotações eu fiz?",
  ])("%s → leitura, não comando", (question) => {
    expect(classifySasaText(question)).toBeNull();
  });

  it("os pedidos continuam funcionando", () => {
    expect(classifySasaText("a Ana disse que vai pensar")).toEqual({ tool: "lead.note" });
    expect(classifySasaText("fechou a venda do Carlos")).toEqual({ tool: "sale.start" });
    expect(classifySasaText("o Carlos está em negociação")).toEqual({ tool: "lead.stage", status: "negotiation" });
    expect(classifySasaText("quando é meu próximo plantão?")).toEqual({ tool: "duty.next" });
    expect(classifySasaText("tenho retorno atrasado?")).toEqual({ tool: "agenda.list" });
  });
});

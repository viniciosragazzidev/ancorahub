// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({ simulateCatalogAction: vi.fn() }));

import { CotacaoLiteWorkspace } from "./cotacao-lite-workspace";
import type { QuoteResponse } from "../contracts";

const RESPOSTA: QuoteResponse = {
  results: [],
  total: 0,
  page: 1,
  pages: 1,
  compatible: 0,
  pending: 0,
  incompatible: 0,
  release: "teste",
  date: "2026-11-11",
};

const base = { options: { cities: ["São Paulo"] }, counts: { plans: 10 }, sourceDate: "2026-11-01" };

afterEach(() => cleanup());

describe("CotacaoLiteWorkspace", () => {
  it("começa pela modalidade, com progresso de passo 1 de 4", () => {
    render(<CotacaoLiteWorkspace {...base} simular={async () => ({ data: RESPOSTA })} />);
    expect(screen.getByRole("heading", { name: "Qual é o tipo de plano?" })).toBeTruthy();
    expect(screen.getByText("Passo 1 de 4")).toBeTruthy();
  });

  it("avança para o município após escolher a modalidade e não deixa PME seguir sem cidade", () => {
    render(<CotacaoLiteWorkspace {...base} simular={async () => ({ data: RESPOSTA })} />);
    fireEvent.click(screen.getByRole("button", { name: "Saúde empresarial / PME" }));
    expect(screen.getByRole("heading", { name: "Em qual município?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert").textContent).toBe("Informe o município de comercialização.");
  });

  it("pede a idade do titular antes de liberar o refino", () => {
    render(<CotacaoLiteWorkspace {...base} simular={async () => ({ data: RESPOSTA })} />);
    fireEvent.click(screen.getByRole("button", { name: "Saúde pessoa física" }));
    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert").textContent).toBe("Informe a idade do titular para calcular os valores.");
  });

  it("mostra mensagem clara quando a consulta falha", async () => {
    const simular = vi.fn(async () => ({ error: "Consulta indisponível." }));
    render(<CotacaoLiteWorkspace {...base} simular={simular} />);
    fireEvent.click(screen.getByRole("button", { name: "Saúde pessoa física" }));
    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    fireEvent.change(screen.getByLabelText("Idade do titular"), { target: { value: "35" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver planos" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Consulta indisponível.");
    expect(simular).toHaveBeenCalledTimes(1);
  });
});

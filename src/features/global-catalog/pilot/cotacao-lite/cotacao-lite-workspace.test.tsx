// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({
  simulateCatalogAction: vi.fn(),
  getCatalogPlanAction: vi.fn(),
  getCatalogNetworkAction: vi.fn(),
}));
vi.mock("../proposal-action", () => ({ exportCatalogProposalAction: vi.fn() }));
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { CotacaoLiteWorkspace } from "./cotacao-lite-workspace";
import type { QuoteResponse, QuoteResult } from "../contracts";

const plano = (id: string, name: string, state: QuoteResult["state"], totalCents: number, reasons: string[] = []): QuoteResult => ({
  id, name, code: id, operator: "Operadora Teste", operatorId: "op", administrator: "", modality: "PESSOA_FISICA",
  accommodation: "Enfermaria", coparticipation: "Sem", coverage: "Nacional", entity: "", dental: null, minAge: null, maxAge: null,
  holderMin: null, holderMax: null, dependentMin: null, dependentMax: null, minLives: null, maxLives: null, minHolders: null,
  ageConfirmed: true, eligibilityConfirmed: true, businessConfirmed: true, from: null, to: null, networkCount: 10, detailCount: 1,
  totalCents, perLife: [{ age: 35, holder: true, priceId: "p", cents: totalCents, from: null, to: null }], state, reasons,
});

const RESPOSTA_VAZIA: QuoteResponse = { results: [], total: 0, page: 1, pages: 1, compatible: 0, pending: 0, incompatible: 0, release: "teste", date: "2026-11-11" };
const RESPOSTA_COM_PLANOS: QuoteResponse = {
  results: [plano("a", "Plano A", "ready", 10000), plano("b", "Plano B", "pending", 20000, ["Idade limite não confirmada."])],
  total: 2, page: 1, pages: 1, compatible: 1, pending: 1, incompatible: 0, release: "teste", date: "2026-11-11",
};

const base = {
  options: { cities: ["São Paulo"], businessProfiles: ["ME", "EPP"], entities: ["Sindicato X"] },
  counts: { plans: 10 },
  sourceDate: "2026-11-01",
};

// jsdom não tem matchMedia; o hook de celular (useIsMobile) precisa dele. Simula desktop (sem coincidência).
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

afterEach(() => cleanup());

/** Leva a pessoa física até o campo de vidas, sem município. */
async function chegarAsVidas() {
  fireEvent.click(screen.getByRole("button", { name: "Saúde pessoa física" }));
  fireEvent.click(await screen.findByRole("button", { name: "Pular" }));
}

describe("CotacaoLiteWorkspace", () => {
  it("começa pela modalidade, com progresso de 4 passos para pessoa física", () => {
    render(<CotacaoLiteWorkspace {...base} simular={async () => ({ data: RESPOSTA_VAZIA })} />);
    expect(screen.getByRole("heading", { name: "Qual é o tipo de plano?" })).toBeTruthy();
    expect(screen.getByText(/Passo 1 de 4/)).toBeTruthy();
  });

  it("PME passa pelo perfil da empresa antes das vidas", async () => {
    render(<CotacaoLiteWorkspace {...base} cidadesPopulares={["São Paulo"]} simular={async () => ({ data: RESPOSTA_VAZIA })} />);
    fireEvent.click(screen.getByRole("button", { name: "Saúde empresarial / PME" }));
    expect(await screen.findByRole("heading", { name: "Em qual município?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "São Paulo" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("heading", { name: "Qual é o perfil da empresa?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert").textContent).toBe("Escolha o tipo de empresa.");
  });

  it("não deixa PME seguir sem cidade", async () => {
    render(<CotacaoLiteWorkspace {...base} simular={async () => ({ data: RESPOSTA_VAZIA })} />);
    fireEvent.click(screen.getByRole("button", { name: "Saúde empresarial / PME" }));
    fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert").textContent).toBe("Informe o município de comercialização.");
  });

  it("pede a idade do titular antes de liberar o refino", async () => {
    render(<CotacaoLiteWorkspace {...base} simular={async () => ({ data: RESPOSTA_VAZIA })} />);
    await chegarAsVidas();
    await screen.findByRole("heading", { name: "Quem vai entrar no plano?" });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert").textContent).toBe("Informe a idade do titular para calcular os valores.");
  });

  it("mostra a lista de planos com o estado de cada um", async () => {
    const simular = vi.fn(async () => ({ data: RESPOSTA_COM_PLANOS }));
    render(<CotacaoLiteWorkspace {...base} simular={simular} />);
    await chegarAsVidas();
    fireEvent.change(await screen.findByLabelText("Idade do titular"), { target: { value: "35" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ver planos" }));
    expect(await screen.findByRole("heading", { name: "Encontrei 2 planos." })).toBeTruthy();
    expect(screen.getByText("Pronto")).toBeTruthy();
    expect(screen.getByText("Falta confirmar: Idade limite não confirmada. Confirme com a operadora ou com a sua equipe antes de gerar a proposta.")).toBeTruthy();
    expect(simular).toHaveBeenCalledTimes(1);
  });

  it("permite comparar até 3 planos e só habilita a comparação com 2 ou mais", async () => {
    render(<CotacaoLiteWorkspace {...base} simular={async () => ({ data: RESPOSTA_COM_PLANOS })} />);
    await chegarAsVidas();
    fireEvent.change(await screen.findByLabelText("Idade do titular"), { target: { value: "35" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ver planos" }));
    await screen.findByRole("heading", { name: "Encontrei 2 planos." });
    const comparar = screen.getByRole("button", { name: /Comparar \(0\/3\)/ }) as HTMLButtonElement;
    expect(comparar.disabled).toBe(true);
    const botoesComparar = screen.getAllByRole("button", { name: "Comparar" });
    fireEvent.click(botoesComparar[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Comparar" })[0]);
    await waitFor(() => expect((screen.getByRole("button", { name: /Comparar \(2\/3\)/ }) as HTMLButtonElement).disabled).toBe(false));
  });

  it("mostra mensagem clara quando a consulta falha", async () => {
    const simular = vi.fn(async () => ({ error: "Consulta indisponível." }));
    render(<CotacaoLiteWorkspace {...base} simular={simular} />);
    await chegarAsVidas();
    fireEvent.change(await screen.findByLabelText("Idade do titular"), { target: { value: "35" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ver planos" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Consulta indisponível.");
    expect(simular).toHaveBeenCalledTimes(1);
  });
});

/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createNegotiationsFixture } from "./fixtures";
import { NegotiationsDashboard } from "./negotiations-dashboard";

const navigation = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(navigation.search) }));
vi.mock("next/link", async () => {
  const React = await import("react");
  return { default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement("a", { href, ...props }, children) };
});
vi.mock("@/components/dashboard-header", () => ({ DashboardHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("./actions", () => ({ getNegotiationTimelineAction: vi.fn(async () => ({ success: true, events: [] })) }));

afterEach(() => {
  cleanup();
  navigation.search = "";
});

describe("NegotiationsDashboard", () => {
  it("renderiza a área Lite e pagina a lista com dados sintéticos", async () => {
    const data = createNegotiationsFixture("director");
    const { container } = render(<NegotiationsDashboard data={data} activeTab="negotiations" generatedAt={new Date(data.generatedAt)} />);

    expect(screen.getByRole("heading", { name: "Negociações" })).toBeTruthy();
    expect(container.querySelector('.arc-venancor[data-skin="diretor"]')).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Visões de negociações" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Negociações agora" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Sem conversa no CRM/ })).toBeTruthy();
    expect(container.querySelectorAll('[data-lite="table"] tbody tr')).toHaveLength(20);
    const firstRow = container.querySelector('[data-lite="table"] tbody tr') as HTMLElement;
    expect(within(firstRow).getByText("Aguardando resposta")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Aguardando resposta/ }).textContent).toContain(String(data.counts.customers_waiting));

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(container.querySelectorAll('[data-lite="table"] tbody tr')).toHaveLength(10));
  });

  it("filtra a lista pelas etapas do resumo e mostra o número que entrou hoje", () => {
    const data = createNegotiationsFixture("director");
    const now = new Date(data.generatedAt);
    let advancedSeen = 0;
    data.leads = data.leads.map((lead) => {
      if (lead.level !== "advanced") return lead;
      advancedSeen += 1;
      return { ...lead, stageEnteredAt: advancedSeen <= 2 ? "2026-10-26T15:00:00.000Z" : "2026-10-25T15:00:00.000Z" };
    });
    const { container } = render(<NegotiationsDashboard data={data} activeTab="negotiations" generatedAt={now} />);

    const advanced = screen.getByRole("button", { name: /Negociação avançada/ });
    expect(advanced.textContent).toContain("2 entraram na etapa atual hoje");
    fireEvent.click(advanced);
    expect(advanced.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelectorAll('[data-lite="table"] tbody tr')).toHaveLength(data.counts.advanced);
  });

  it("filtra a lista pela busca e abre a aba de estatísticas", () => {
    const data = createNegotiationsFixture("manager");
    const { container, rerender } = render(<NegotiationsDashboard data={data} activeTab="negotiations" generatedAt={new Date(data.generatedAt)} />);
    const search = screen.getByRole("searchbox", { name: "Buscar nas negociações" });
    fireEvent.change(search, { target: { value: "Mariana Oliveira" } });
    expect(container.querySelectorAll('[data-lite="table"] tbody tr')).toHaveLength(1);

    rerender(<NegotiationsDashboard data={data} activeTab="statistics" generatedAt={new Date(data.generatedAt)} />);
    expect(screen.getByRole("heading", { name: "Saúde da IA" })).toBeTruthy();
    expect(screen.getByText("Análises nas últimas 24 horas")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Em avançada (atual)" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Em fechamento (atual)" })).toBeTruthy();
  });

  it("abre o painel lateral do lead ao selecionar uma linha", async () => {
    const data = createNegotiationsFixture("director");
    const { container } = render(<NegotiationsDashboard data={data} activeTab="negotiations" generatedAt={new Date(data.generatedAt)} />);

    fireEvent.click(container.querySelector('[data-lite="table"] tbody tr')!);
    expect(await screen.findByRole("heading", { name: "Linha do tempo" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir conversa" }).getAttribute("href")).toBe(`/mensagens/${data.leads[0]!.id}`);
  });

  it("mantém a unidade escolhida no topo e ao alternar para estatísticas", () => {
    const data = createNegotiationsFixture("director");
    data.scope.branchId = "branch-norte";
    data.scope.branchName = "Unidade Norte";
    navigation.search = "unidade=branch-norte";
    render(<NegotiationsDashboard data={data} activeTab="negotiations" generatedAt={new Date(data.generatedAt)} />);

    expect(screen.getByRole("button", { name: /Unidade Norte/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Estatísticas" }).getAttribute("href")).toBe("/negociacoes?aba=estatisticas&unidade=branch-norte");
  });

  it("explica quando o contexto não tem escopo disponível", () => {
    const data = createNegotiationsFixture("supervisor");
    data.scope.scopeMessage = "Nenhum corretor está associado à sua equipe.";
    render(<NegotiationsDashboard data={data} activeTab="negotiations" generatedAt={new Date(data.generatedAt)} />);

    expect(screen.getByRole("status").textContent).toContain("Escopo indisponível");
    expect(screen.getByText("Nenhum corretor está associado à sua equipe.")).toBeTruthy();
  });
});

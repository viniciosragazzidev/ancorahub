// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  const { captureMotion } = await import("@/components/lite/motion/capture-motion");
  return { ...actual, motion: captureMotion(), useReducedMotion: () => motionState.reduce };
});

// Fixtures: os construtores de exemplo da prévia devolvem o painel essencial tipado.
import { buildEssential, emptyEssential } from "@/app/dev/diretor-dashboard-preview/_components/essential-example";

import { displacementOf, readMotion } from "@/components/lite/motion/capture-motion";

import { DirectorLiteDashboard } from "./director-lite-dashboard";

const NOW = new Date("2026-10-24T16:42:00.000Z");
const BRANCHES = [
  { id: "branch-centro", name: "Centro" },
  { id: "branch-barra", name: "Barra da Tijuca" },
];

afterEach(() => {
  cleanup();
  motionState.reduce = false;
});

describe("painel essencial: ordem, cabeçalho e filtros", () => {
  it("mostra a saudação, as abas e a nota de que o período muda só os leads por fila", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(screen.getByRole("heading", { level: 1, name: "Olá" })).toBeInTheDocument();
    const tabs = within(screen.getByRole("navigation", { name: "Abas do painel" }));
    expect(tabs.getByRole("link", { name: "Visão da operação" })).toHaveAttribute("aria-current", "page");
    expect(tabs.getByRole("link", { name: "Qualidade dos leads" })).toHaveAttribute("href", "/dashboard?tab=quality");
    expect(screen.getByText("O período muda só os leads por fila. Plantões e WhatsApp mostram agora.")).toBeInTheDocument();
  });

  it("mostra só os três blocos, nesta ordem", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const blocks = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(blocks).toEqual(["Plantões acontecendo agora", "Leads por fila", "WhatsApp dos corretores"]);
  });

  it("marca o período ativo e leva o filtro de unidade junto", () => {
    render(<DirectorLiteDashboard data={buildEssential("7d", "all", NOW)} period="7d" branchId="branch-centro" branches={BRANCHES} now={NOW} />);
    const periods = within(screen.getByRole("navigation", { name: "Período" }));
    expect(periods.getByRole("link", { name: "7 dias" })).toHaveAttribute("aria-current", "true");
    expect(periods.getByRole("link", { name: "Hoje" })).toHaveAttribute("href", "/dashboard?periodo=hoje&unidade=branch-centro");
  });

  it("oferece as unidades e marca a escolhida", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId="branch-barra" branches={BRANCHES} now={NOW} />);
    const units = within(screen.getByRole("navigation", { name: "Unidade" }));
    expect(units.getByRole("link", { name: "Todas as unidades" })).not.toHaveAttribute("aria-current");
    expect(units.getByRole("link", { name: "Barra da Tijuca" })).toHaveAttribute("aria-current", "true");
    expect(units.getByRole("link", { name: "Centro" })).toHaveAttribute("href", "/dashboard?periodo=hoje&unidade=branch-centro");
  });

  it("sem unidades no escopo (sem permissão de comparar), o filtro de unidade some", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={[]} now={NOW} />);
    expect(screen.queryByRole("navigation", { name: "Unidade" })).not.toBeInTheDocument();
  });
});

describe("bloco 1: plantões acontecendo agora", () => {
  it("mostra um card por plantão ativo, com disponíveis, distribuídos e corretores ativos", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const pme = screen.getByRole("link", { name: /Plantão PME/ });
    expect(pme).toHaveAttribute("href", "/leads/distribuicao/plantao/pme");
    expect(screen.getByText("2 plantões ativos neste momento.", { exact: false })).toBeInTheDocument();
    const figures = within(pme.closest("li") as HTMLElement);
    expect(figures.getByText("Disponíveis")).toBeInTheDocument();
    expect(figures.getByText("Distribuídos hoje")).toBeInTheDocument();
    expect(figures.getByText("Corretores ativos")).toBeInTheDocument();
    // PME tem 2 corretores confirmados de 3 escalados (abaixo do mínimo): o número aparece em alerta.
    expect(figures.getByText("de 3 escalados")).toBeInTheDocument();
    expect(figures.getByText("Presença confirmada hoje.")).toBeInTheDocument();
    expect(pme.closest("li")!.querySelector('[data-warn="true"]')).not.toBeNull();
  });

  it("sem plantão ativo, mostra o estado vazio com o próximo plantão", () => {
    const data = { ...emptyEssential(NOW), duties: { running: [], next: { scheduleId: "x", name: "Plantão Noturno", dutyDate: "2026-10-26", startsAt: "19:00", endsAt: "23:00", running: false, queueName: null, brokerCount: 0, minimumBrokers: 1 } } };
    render(<DirectorLiteDashboard data={data} period="today" branchId={null} branches={[]} now={NOW} />);
    expect(screen.getByText("Nenhum plantão ativo neste momento.")).toBeInTheDocument();
    expect(screen.getByText("Próximo: Plantão Noturno, 26/10 às 19:00.")).toBeInTheDocument();
  });
});

describe("bloco 2: leads por fila", () => {
  it("mostra a janela do dia no cabeçalho (sábado vem da sexta 19h)", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(screen.getByText("desde sex 19h")).toBeInTheDocument();
  });

  it("tem uma linha por fila, a legenda da temperatura e a linha de total", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const table = within(screen.getByRole("table", { name: "Leads por fila, desde sex 19h" }));
    expect(table.getByText("Fila Tatiana")).toBeInTheDocument();
    expect(table.getByText("PF Renan")).toBeInTheDocument();
    expect(table.getByText("Total")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "9 quentes, 6 mornos, 7 frios" })).toBeInTheDocument();
    expect(screen.getByText(/Qualificados = quentes \+ mornos/)).toBeInTheDocument();
  });

  it("conta as tentativas de requalificação e quantos frios tiveram 1, 2 ou 3+", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    // Fila Tatiana: 7 tentativas; PF Renan: 1 (um frio com 0 tentativas conta como frio, mas não como tentativa). Total: 8.
    expect(screen.getAllByText(/8 tentativas/).length).toBeGreaterThan(0);
    expect(screen.getByText(/6 frios: 3 com 1, 1 com 2, 1 com 3\+/)).toBeInTheDocument();
  });

  it("sem leads na janela, o estado vazio aparece no lugar da tabela", () => {
    render(<DirectorLiteDashboard data={emptyEssential(NOW)} period="today" branchId={null} branches={[]} now={NOW} />);
    expect(screen.getByText("Nenhum lead entrou desde sex 19h.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum lead nesta janela")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("bloco 3: WhatsApp dos corretores", () => {
  it("mostra quantos conectaram, recebidos, respondendo, taxa e atendimentos ativos", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(screen.getByText("de 5 corretores conectaram o WhatsApp pessoal", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Recebidos")).toBeInTheDocument();
    expect(screen.getByText("37%")).toBeInTheDocument();
    expect(screen.getByText("Atendimentos ativos")).toBeInTheDocument();
  });

  it("lista só os corretores conectados, ordenados por atendimentos ativos", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const list = within(screen.getByRole("list", { name: "Corretores conectados, com atendimentos ativos" }));
    const names = list.getAllByRole("link").map((link) => link.getAttribute("title"));
    expect(names).toEqual(["Ver conversas de Ana Souza", "Ver conversas de Carla Dias", "Ver conversas de Bruno Lima"]);
    expect(screen.queryByText("Diego Reis")).not.toBeInTheDocument();
  });

  it("nenhum corretor conectado: estado vazio no lugar da lista", () => {
    render(<DirectorLiteDashboard data={emptyEssential(NOW)} period="today" branchId={null} branches={[]} now={NOW} />);
    expect(screen.getByText("Nenhum corretor conectou o WhatsApp")).toBeInTheDocument();
  });
});

describe("movimento", () => {
  it("move nada com movimento reduzido: sem y, x ou escala em repouso em nenhum bloco", () => {
    motionState.reduce = true;
    const { container } = render(<DirectorLiteDashboard data={buildEssential("30d", "all", NOW)} period="30d" branchId={null} branches={BRANCHES} now={NOW} />);
    const animated = Array.from(container.querySelectorAll("[data-initial]"));
    expect(animated.length).toBeGreaterThan(0);
    for (const element of animated) {
      expect(displacementOf(readMotion(element).initial)).toEqual([]);
    }
  });

  it("move os blocos com movimento ligado, para o teste reduzido ter sentido", () => {
    motionState.reduce = false;
    const { container } = render(<DirectorLiteDashboard data={buildEssential("30d", "all", NOW)} period="30d" branchId={null} branches={BRANCHES} now={NOW} />);
    const moving = Array.from(container.querySelectorAll("[data-initial]")).filter((element) => displacementOf(readMotion(element).initial).length > 0);
    expect(moving.length).toBeGreaterThan(0);
  });
});

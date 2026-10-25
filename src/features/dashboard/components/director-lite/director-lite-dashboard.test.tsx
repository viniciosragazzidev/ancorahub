// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.stubGlobal("matchMedia", (media: string) => ({
  matches: motionState.reduce,
  media,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));
// O cabeçalho navega com o router do Next; nos testes, só o push é observado.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard" }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  const { captureMotion } = await import("@/components/lite/motion/capture-motion");
  return { ...actual, motion: captureMotion(), useReducedMotion: () => motionState.reduce };
});

// Fixtures: os construtores de exemplo da prévia devolvem o painel essencial tipado.
import { buildEssential, emptyEssential } from "@/app/dev/diretor-dashboard-preview/_components/essential-example";

import { displacementOf, readMotion } from "@/components/lite/motion/capture-motion";

vi.mock("@/components/dashboard-header", () => ({
  DashboardHeader: ({ breadcrumb, title }: { breadcrumb: string; title: string }) => <header data-testid="director-dashboard-header"><span>{breadcrumb}</span><h1>{title}</h1></header>,
}));

import { DirectorLiteDashboard } from "./director-lite-dashboard";
import styles from "./director-lite.module.css";

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
  it("mostra o topo global, as abas e a nota de que o período muda só os leads por fila", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(screen.getByRole("heading", { level: 1, name: "Painel" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: /Ol\u00e1, Renata/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Ol\u00e1, Renata/)).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Painel do diretor" })).toHaveClass(styles.pageContainer);
    const tabs = within(screen.getByRole("navigation", { name: "Abas do painel" }));
    expect(tabs.getByRole("link", { name: "Visão da operação" })).toHaveAttribute("aria-current", "page");
    expect(tabs.getByRole("link", { name: "Qualidade dos leads" })).toHaveAttribute("href", "/dashboard?tab=quality&periodo=hoje");
    expect(screen.getByLabelText("Sobre o per\u00edodo")).toBeInTheDocument();
    expect(screen.getByText("O per\u00edodo altera apenas os leads por fila.")).toBeInTheDocument();
  });

  it("mostra só os três blocos, nesta ordem", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const blocks = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(blocks).toEqual(["Plantões acontecendo agora", "Leads por fila", "WhatsApp dos corretores"]);
  });

  it("as abas têm rótulo curto para o celular, escondido do leitor de tela (o nome acessível segue completo)", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const tabs = within(screen.getByRole("navigation", { name: "Abas do painel" }));
    const quality = tabs.getByRole("link", { name: "Qualidade dos leads" });
    expect(quality.querySelector('[aria-hidden="true"]')).toHaveTextContent("Qualidade");
    expect(tabs.getByRole("link", { name: "Funil de qualificação" }).querySelector('[aria-hidden="true"]')).toHaveTextContent("Funil");
  });

  it("marca o período ativo e leva o filtro de unidade junto", () => {
    render(<DirectorLiteDashboard data={buildEssential("7d", "all", NOW)} period="7d" branchId="branch-centro" branches={BRANCHES} now={NOW} />);
    const periods = within(screen.getByRole("navigation", { name: "Período" }));
    expect(periods.getByRole("link", { name: "7 dias" })).toHaveAttribute("aria-current", "true");
    expect(periods.getByRole("link", { name: "Hoje" })).toHaveAttribute("href", "/dashboard?periodo=hoje&unidade=branch-centro");
  });

  it("oferece só as unidades autorizadas num seletor e marca a escolhida", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId="branch-barra" branches={BRANCHES} now={NOW} />);
    const select = screen.getByRole("combobox", { name: "Unidade" }) as HTMLSelectElement;
    expect(select.value).toBe("branch-barra");
    const names = within(select).getAllByRole("option").map((option) => option.textContent);
    expect(names).toEqual(["Todas as unidades", "Centro", "Barra da Tijuca"]);
  });

  it("sem unidades no escopo (sem permissão de comparar), o seletor de unidade some", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={[]} now={NOW} />);
    expect(screen.queryByRole("combobox", { name: "Unidade" })).not.toBeInTheDocument();
  });
});

describe("bloco 1: plantões acontecendo agora", () => {
  it("mostra um card por plantão ativo, com disponíveis, distribuídos e corretores ativos", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const pme = screen.getByRole("link", { name: /Plantão PME/ });
    expect(pme).toHaveAttribute("href", "/leads/distribuicao/plantao/pme");
    expect(screen.getByText("2 plantões ativos neste momento.", { exact: false })).toBeInTheDocument();
    const figures = within(pme.closest("li") as HTMLElement);
    expect(figures.getByText("disponíveis")).toBeInTheDocument();
    expect(figures.getByText("distribuídos")).toBeInTheDocument();
    // PME tem 2 corretores confirmados de 3 escalados: "2/3", em alerta por estar abaixo do mínimo.
    expect(figures.getByText("2/3")).toBeInTheDocument();
    expect(figures.getByText("corretores")).toBeInTheDocument();
    expect(pme.closest("li")!.querySelector('[data-warn="true"]')).not.toBeNull();
    // As frases explicativas saíram do card: ficam no ícone de ajuda da seção.
    expect(figures.queryByText(/Aguardando distribuição/)).not.toBeInTheDocument();
    expect(screen.getByText("Disponíveis: aguardando distribuição nesta fila agora.")).toBeInTheDocument();
    expect(screen.getByLabelText("Como ler os números dos plantões")).toBeInTheDocument();
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
    expect(screen.getByText("Qualificados: leads quentes e mornos.")).toBeInTheDocument();
    expect(screen.getByLabelText("Como ler os dados de leads por fila")).toBeInTheDocument();
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
    expect(screen.getByText("Quando um lead entrar, ele aparece aqui, separado por fila.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("bloco 3: WhatsApp dos corretores", () => {
  it("mostra quantos conectaram, recebidos, respondendo, taxa e atendimentos ativos", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(screen.getByText("de 5 corretores conectaram o WhatsApp pessoal", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("recebidos")).toBeInTheDocument();
    expect(screen.getByText("respondendo · 37%")).toBeInTheDocument();
    expect(screen.getByText("atendimentos ativos")).toBeInTheDocument();
    expect(screen.getByLabelText("Como ler os números do WhatsApp")).toBeInTheDocument();
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
    expect(screen.getByText(/Nenhum corretor ativo para mostrar/)).toBeInTheDocument();
    expect(screen.queryByText(/0 de 0/)).not.toBeInTheDocument();
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

  it("entra com opacidade sem deslocar o layout", () => {
    motionState.reduce = false;
    const { container } = render(<DirectorLiteDashboard data={buildEssential("30d", "all", NOW)} period="30d" branchId={null} branches={BRANCHES} now={NOW} />);
    const entering = Array.from(container.querySelectorAll("[data-initial]")).filter((element) => readMotion(element).initial?.opacity === 0);
    expect(entering.length).toBeGreaterThan(0);
    for (const element of entering) {
      const motion = readMotion(element);
      expect(displacementOf(motion.initial)).toEqual([]);
      const nestedTransition = motion.animate?.transition as { duration?: number } | undefined;
      expect(motion.transition?.duration ?? nestedTransition?.duration).toBeGreaterThan(0);
    }
  });

  it("com a preferência de movimento do site, o odômetro dos números não roda", () => {
    const digitsRolling = (container: HTMLElement) => container.querySelectorAll('span[style*="inline-flex"]').length;
    const data = buildEssential("30d", "all", NOW);
    motionState.reduce = false;
    const { container, unmount } = render(<DirectorLiteDashboard data={data} period="30d" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(digitsRolling(container)).toBeGreaterThan(0);
    unmount();

    document.documentElement.dataset.reduceMotion = "1";
    try {
      const reduced = render(<DirectorLiteDashboard data={data} period="30d" branchId={null} branches={BRANCHES} now={NOW} />);
      expect(digitsRolling(reduced.container)).toBe(0);
      // 30 dias: o total de entradas do exemplo é 576 (36 x 16).
      expect(reduced.container.textContent).toContain("576");
    } finally {
      delete document.documentElement.dataset.reduceMotion;
    }
  });

  it("agrupa o milhar em pt-BR nas contagens por corretor e de requalificação", () => {
    const data = buildEssential("today", "all", NOW);
    const [first] = data.whatsapp.brokers;
    const big = { ...data, whatsapp: { ...data.whatsapp, brokers: [{ ...first!, received: 1234, responding: 1000 }] } };
    render(<DirectorLiteDashboard data={big} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(screen.getByText(/1\.000 de 1\.234 respondendo/)).toBeInTheDocument();
  });
});

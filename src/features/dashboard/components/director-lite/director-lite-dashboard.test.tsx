// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
import { summarizeWhatsApp, type BrokerWhatsAppRow } from "@/features/dashboard/essential/essential-summary";

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

/** Seis corretores conectados e um sem WhatsApp: o cartão mostra 4, "Ver todos os corretores" abre o resto. */
const MANY_BROKERS: BrokerWhatsAppRow[] = [
  { id: "ana", name: "Ana Souza", connected: true, received: 14, responding: 6, active: 4 },
  { id: "bruno", name: "Bruno Lima", connected: true, received: 12, responding: 3, active: 1 },
  { id: "carla", name: "Carla Dias", connected: true, received: 9, responding: 4, active: 3 },
  { id: "fabio", name: "Fábio Rocha", connected: true, received: 8, responding: 5, active: 6 },
  { id: "gabi", name: "Gabriela Nunes", connected: true, received: 5, responding: 2, active: 2 },
  { id: "hugo", name: "Hugo Prado", connected: true, received: 3, responding: 1, active: 0 },
  { id: "diego", name: "Diego Reis", connected: false, received: 0, responding: 0, active: 0 },
];

function withBrokers(rows: BrokerWhatsAppRow[]) {
  const data = buildEssential("today", "all", NOW);
  return { ...data, whatsapp: { ...data.whatsapp, ...summarizeWhatsApp(rows) } };
}

afterEach(() => {
  cleanup();
  motionState.reduce = false;
});

describe("painel essencial: ordem, cabeçalho e filtros", () => {
  it("mostra o topo global, as abas e a nota de que o período muda só os leads por fila", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(screen.getByRole("heading", { level: 1, name: "Painel" })).toBeInTheDocument();
    // 27/11/2026: a saudação voltou (16h42 UTC são 13h42 em Brasília) com a frase da situação.
    const data = buildEssential("today", "all", NOW);
    expect(screen.getByRole("heading", { level: 1, name: "Boa tarde, Renata" })).toBeInTheDocument();
    expect(screen.getByText(`Hoje entraram ${data.queues.totals.arrived} leads. 2 coisas pedem você agora.`)).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Painel" })).toHaveClass(styles.pageContainer);
    const tabs = within(screen.getByRole("navigation", { name: "Seções do painel" }));
    expect(tabs.getByRole("link", { name: "Visão geral" })).toHaveAttribute("aria-current", "page");
    expect(tabs.getByRole("link", { name: "Qualidade dos leads" })).toHaveAttribute("href", "/dashboard?tab=quality&periodo=hoje");
    expect(screen.getByLabelText("Sobre o per\u00edodo")).toBeInTheDocument();
    expect(screen.getByText("O per\u00edodo altera apenas os leads por fila.")).toBeInTheDocument();
  });

  it("não inclui a faixa de status vivos no painel do diretor", () => {
    const { container } = render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(container.querySelector("[data-live-status-strip]")).toBeNull();
  });

  it("organização de 27/11: números, plantões e WhatsApp antes da análise (funil e tabela de filas); Precisa de você fica no topo", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const blocks = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent ?? "");
    expect(blocks.map((text) => text.replace(/\d+$/, ""))).toEqual([
      "Leads desde sex 19h",
      "Plantões agora",
      "WhatsApp dos corretores",
      "Funil de qualificação",
      "Leads por fila",
    ]);
    // O que pede decisão não é mais um bloco da página: é o botão do topo, junto dos filtros, com a gaveta fechada.
    expect(screen.getByRole("button", { name: /Precisa de você/ }).closest("header")).not.toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Precisa de você mostra a contagem e abre a gaveta com até 3 itens, cada um com um verbo só", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const button = screen.getByRole("button", { name: /Precisa de você/ });
    expect(button).toHaveTextContent("Precisa de você2");
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const attention = within(screen.getByRole("dialog", { name: "Precisa de você agora" }));
    const items = attention.getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(3);
    for (const item of items) expect(within(item).getAllByRole("link")).toHaveLength(1);
    expect(attention.getByText("Plantão PME abaixo do mínimo")).toBeInTheDocument();
    expect(attention.getByRole("link", { name: /Ver plantão/ })).toHaveAttribute("href", "/leads/distribuicao/plantao/pme");
  });

  it("sem pendência, o botão diz Tudo em dia e a gaveta confirma que nada pede decisão", () => {
    render(<DirectorLiteDashboard data={emptyEssential(NOW)} period="today" branchId={null} branches={[]} now={NOW} />);
    expect(screen.queryByRole("button", { name: /Precisa de você/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tudo em dia" }));
    const drawer = within(screen.getByRole("dialog", { name: "Precisa de você agora" }));
    expect(drawer.getByText("Tudo em dia. Nada pedindo decisão agora.")).toBeInTheDocument();
    expect(drawer.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("mostra os quatro números da janela e nenhum dado de venda", () => {
    const { container } = render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const cards = within(screen.getByRole("heading", { name: "Leads desde sex 19h" }).closest("section") as HTMLElement);
    for (const label of ["Entraram", "Qualificados", "Em qualificação", "Frios"]) expect(cards.getByText(label)).toBeInTheDocument();
    expect(cards.getByText("56% do que entrou")).toBeInTheDocument();
    expect(screen.getByText("56% qualificados", { exact: false })).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/R\$|venda/i);
  });

  it("as abas têm rótulo curto para o celular, escondido do leitor de tela (o nome acessível segue completo)", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const tabs = within(screen.getByRole("navigation", { name: "Seções do painel" }));
    // O ícone também é aria-hidden; o rótulo curto é o span escondido do leitor de tela.
    const short = (name: string) => tabs.getByRole("link", { name }).querySelector('span[aria-hidden="true"]');
    expect(short("Visão geral")).toHaveTextContent("Geral");
    expect(short("Qualidade dos leads")).toHaveTextContent("Qualidade");
    expect(short("Funil")).toHaveTextContent("Funil");
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
    const figure = (duty: HTMLElement, label: string) => within(duty).getByText(label).parentElement?.querySelector("strong")?.textContent;
    expect(figure(pme, "disponíveis")).toBe("6");
    expect(figure(pme, "distribuídos")).toBe("9");
    // PME tem 2 corretores confirmados de 3 escalados: em alerta (e no "Precisa de você") por estar abaixo do mínimo.
    expect(figure(pme, "abaixo do mínimo")).toBe("2/3");
    expect(within(pme).queryByText("corretores")).not.toBeInTheDocument();
    expect(within(pme).getByText("08:00 às 19:00")).toBeInTheDocument();
    const presencial = screen.getByRole("link", { name: /Plantão Presencial/ });
    expect(presencial).toHaveAttribute("href", "/leads/distribuicao/plantao/presencial");
    expect(figure(presencial, "disponíveis")).toBe("0");
    expect(figure(presencial, "distribuídos")).toBe("4");
    expect(figure(presencial, "corretores")).toBe("3/3");
  });

  it("sem plantão ativo, mostra o estado vazio com o próximo plantão", () => {
    const data = { ...emptyEssential(NOW), duties: { running: [], next: { scheduleId: "x", name: "Plantão Noturno", dutyDate: "2026-10-26", startsAt: "19:00", endsAt: "23:00", running: false, queueName: null, brokerCount: 0, minimumBrokers: 1 } } };
    render(<DirectorLiteDashboard data={data} period="today" branchId={null} branches={[]} now={NOW} />);
    expect(screen.getByText(/Nenhum plantão ativo\. Próximo: Plantão Noturno, 26\/10 às 19:00\./)).toBeInTheDocument();
  });
});

describe("bloco 2: leads por fila", () => {
  it("mostra a janela do dia no cabeçalho (sábado vem da sexta 19h)", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(screen.getByText("desde sex 19h")).toBeInTheDocument();
  });

  it("tem uma linha por fila com entraram, qualificados e frios", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const queues = within(screen.getByRole("heading", { name: /Leads por fila/ }).closest("section") as HTMLElement);
    const cells = (name: string) => within(queues.getByRole("row", { name: new RegExp(name) })).getAllByRole("cell").slice(0, 3).map((cell) => cell.textContent);
    expect(cells("Fila Tatiana")).toEqual(["26", "15", "7"]);
    expect(cells("PF Renan")).toEqual(["10", "5", "5"]);
    expect(screen.getByText("12 quentes · 8 mornos", { exact: false })).toBeInTheDocument();
  });

  it("conta as tentativas de requalificação e quantos frios tiveram 1, 2 ou 3+", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    // Fila Tatiana: 7 tentativas; PF Renan: 1 (um frio com 0 tentativas conta como frio, mas não como tentativa). Total: 8.
    expect(screen.getAllByText(/8 tentativas/).length).toBeGreaterThan(0);
    expect(screen.getByText(/6 frios: 3 com 1, 1 com 2, 1 com 3\+/)).toBeInTheDocument();
  });

  it("sem leads na janela, o estado vazio aparece no lugar da tabela", () => {
    render(<DirectorLiteDashboard data={emptyEssential(NOW)} period="today" branchId={null} branches={[]} now={NOW} />);
    expect(screen.getByText("Nenhum lead entrou desde sex 19h. Quando entrar, aparece aqui separado por fila.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum lead entrou desde sex 19h. Quando entrar, o funil aparece aqui.")).toBeInTheDocument();
    expect(screen.queryByText(/entraram ·/)).not.toBeInTheDocument();
  });
});

describe("bloco 3: WhatsApp dos corretores", () => {
  it("mostra quantos conectaram, recebidos, respondendo, taxa e atendimentos ativos", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const card = within(screen.getByRole("heading", { name: "WhatsApp dos corretores" }).closest("section") as HTMLElement);
    expect(card.getByText("3 de 5 conectados")).toBeInTheDocument();
    expect(card.getByText("recebidos")).toBeInTheDocument();
    expect(card.getByText("respondendo · 37%")).toBeInTheDocument();
    expect(card.getByText("atendimentos ativos")).toBeInTheDocument();
  });

  it("no cartão, só os conectados, ordenados por atendimentos ativos, com link para as conversas; sem botão quando cabem todos", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const links = within(screen.getByRole("list", { name: "Corretores com mais atendimentos ativos" })).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("title"))).toEqual(["Ver conversas de Ana Souza", "Ver conversas de Carla Dias", "Ver conversas de Bruno Lima"]);
    expect(links[0]).toHaveAttribute("href", "/conversas?tab=leads&brokerId=ana");
    expect(screen.queryByText("Diego Reis")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver todos os corretores/ })).not.toBeInTheDocument();
  });

  it("com mais de 4 conectados, o cartão mostra os 4 primeiros e o painel lateral lista todos na mesma ordem", () => {
    render(<DirectorLiteDashboard data={withBrokers(MANY_BROKERS)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const order = ["Fábio Rocha", "Ana Souza", "Carla Dias", "Gabriela Nunes", "Bruno Lima", "Hugo Prado"].map((name) => `Ver conversas de ${name}`);
    const card = within(screen.getByRole("list", { name: "Corretores com mais atendimentos ativos" }));
    expect(card.getAllByRole("link").map((link) => link.getAttribute("title"))).toEqual(order.slice(0, 4));
    expect(screen.queryByRole("list", { name: "Corretores conectados, com atendimentos ativos" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ver todos os corretores \(6\)/ }));
    const panel = within(screen.getByRole("dialog", { name: "WhatsApp dos corretores" }));
    expect(panel.getByText("6 de 7 corretores conectaram o WhatsApp pessoal", { exact: false })).toBeInTheDocument();
    const list = within(panel.getByRole("list", { name: "Corretores conectados, com atendimentos ativos" }));
    expect(list.getAllByRole("link").map((link) => link.getAttribute("title"))).toEqual(order);
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
    const [first, ...rest] = MANY_BROKERS;
    const big = withBrokers([{ ...first!, received: 1234, responding: 1000, active: 2345 }, ...rest]);
    render(<DirectorLiteDashboard data={big} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(within(screen.getByRole("list", { name: "Corretores com mais atendimentos ativos" })).getByText("2.345")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ver todos os corretores/ }));
    expect(screen.getByText(/2\.345 ativos · 1\.000 de 1\.234 respondendo/)).toBeInTheDocument();
  });
});

describe("painel Lite para papéis do modo normal que não são diretor", () => {
  it("marketing: só a aba da operação, sem unidades e nomes dos corretores sem link para Conversas", () => {
    const { container } = render(
      <DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={[]} now={NOW} availableTabs={["overview"]} canOpenConversations={false} />,
    );
    expect(screen.getByRole("main", { name: "Painel" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Qualidade dos leads" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Funil" })).not.toBeInTheDocument();
    expect(screen.queryByText("Todas as unidades")).not.toBeInTheDocument();
    expect(container.querySelector('a[href^="/conversas"]')).toBeNull();
    expect(container).not.toHaveTextContent(/diretor/i);
  });

  it("gestor sem unidade com a central de qualidade: Qualidade aparece, Funil não", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={[]} now={NOW} availableTabs={["overview", "quality"]} />);
    const tabs = within(screen.getByRole("navigation", { name: "Seções do painel" }));
    expect(tabs.getByRole("link", { name: "Qualidade dos leads" })).toBeInTheDocument();
    expect(tabs.queryByRole("link", { name: "Funil" })).not.toBeInTheDocument();
  });
});

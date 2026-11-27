// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

import { summarizeWhatsApp, type BrokerWhatsAppRow } from "@/features/dashboard/essential/essential-summary";

vi.mock("@/components/dashboard-header", () => ({
  DashboardHeader: ({ breadcrumb, title }: { breadcrumb: string; title: string }) => <header data-testid="director-dashboard-header"><span>{breadcrumb}</span><h1>{title}</h1></header>,
}));

import { DirectorLiteDashboard } from "./director-lite-dashboard";
import styles from "./painel.module.css";

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

/** Cópia 1:1 do artifact (27/11/2026): celular e computador moram no mesmo HTML; `m-*` são os blocos do celular. */
const section = (id: string) => within(document.querySelector(`section[aria-labelledby="${id}"]`) as HTMLElement);
const numbersRegion = () => within(screen.getByRole("region", { name: "Números do período" }));
const kpiCard = (label: string) => numbersRegion().getByRole("heading", { level: 3, name: label }).closest("article") as HTMLElement;

afterEach(() => {
  cleanup();
  motionState.reduce = false;
});

describe("painel essencial: ordem, cabeçalho e filtros", () => {
  it("mostra a saudação com a frase da situação e as abas, sem a faixa de topo global", () => {
    const data = buildEssential("today", "all", NOW);
    render(<DirectorLiteDashboard data={data} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    // 27/11/2026: a página começa nas abas, sem o título "Painel" da faixa global.
    expect(screen.queryByRole("heading", { level: 1, name: "Painel" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("director-dashboard-header")).not.toBeInTheDocument();
    // 16h42 UTC são 13h42 em Brasília.
    expect(screen.getByRole("heading", { level: 1, name: "Boa tarde, Renata" })).toBeInTheDocument();
    expect(screen.getByText(`Hoje entraram ${data.queues.totals.arrived} leads. 2 coisas pedem você agora.`)).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Painel" })).toHaveClass(styles.main);
    const tabs = within(screen.getByRole("navigation", { name: "Seções do painel" }));
    expect(tabs.getByRole("link", { name: "Visão geral" })).toHaveAttribute("aria-current", "page");
    expect(tabs.getByRole("link", { name: "Qualidade dos leads" })).toHaveAttribute("href", "/dashboard?tab=quality&periodo=hoje");
  });

  it("não inclui a faixa de status vivos no painel do diretor", () => {
    const { container } = render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(container.querySelector("[data-live-status-strip]")).toBeNull();
  });

  it("organização do artifact: números no topo; plantões e WhatsApp, leads por fila e entradas por hora; Precisa de você fica no topo", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const headings = screen.getAllByRole("heading", { level: 2 });
    const titles = (phone: boolean) => headings.filter((heading) => heading.id.startsWith("m-") === phone).map((heading) => heading.textContent);
    expect(titles(false)).toEqual(["Plantões agora", "WhatsApp dos corretores", "Leads por fila", "Entradas por hora"]);
    // No celular a fila vem antes do WhatsApp, e as entradas por hora ficam de fora.
    expect(titles(true)).toEqual(["Plantões agora", "Leads por fila", "WhatsApp dos corretores"]);
    const numbers = screen.getByRole("region", { name: "Números do período" });
    expect(numbers.compareDocumentPosition(headings[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // O que pede decisão não é um bloco da página: é o botão do topo, junto dos filtros, com a gaveta fechada.
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

  it("mostra os quatro números do período (entraram, qualificados, distribuídos e vendas) com a comparação", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(numbersRegion().getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Entraram", "Qualificados", "Distribuídos", "Vendas"]);
    expect(kpiCard("Entraram")).toHaveTextContent("36");
    // 36 contra 29 ontem.
    expect(within(kpiCard("Entraram")).getByText("+24% sobre ontem")).toBeInTheDocument();
    expect(within(kpiCard("Qualificados")).getByText("56% dos que entraram")).toBeInTheDocument();
    expect(kpiCard("Distribuídos")).toHaveTextContent("68");
    expect(within(kpiCard("Distribuídos")).getByText("Tempo médio até o corretor: 4 min")).toBeInTheDocument();
    // Antes o painel escondia venda; o desenho de 27/11/2026 traz o número e o valor vendido.
    expect(kpiCard("Vendas")).toHaveTextContent("4");
    expect(within(kpiCard("Vendas")).getByText("R$ 3.980 vendidos")).toBeInTheDocument();
  });

  it("sem movimento, os números dizem que nada aconteceu e a nota de Entraram mostra a janela", () => {
    const data = emptyEssential(NOW);
    render(<DirectorLiteDashboard data={data} period="today" branchId={null} branches={[]} now={NOW} />);
    expect(within(kpiCard("Entraram")).getByText(data.queues.label)).toBeInTheDocument();
    expect(numbersRegion().getByText("Nenhum distribuído no período")).toBeInTheDocument();
    expect(numbersRegion().getByText("Nenhuma venda no período")).toBeInTheDocument();
    expect(screen.getByText("Hoje entraram 0 leads. Nada pedindo você agora.")).toBeInTheDocument();
  });

  it("em 7 dias, Entraram compara com a semana anterior", () => {
    render(<DirectorLiteDashboard data={buildEssential("7d", "all", NOW)} period="7d" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(within(kpiCard("Entraram")).getByText(/sobre a semana anterior$/)).toBeInTheDocument();
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
    const periods = within(screen.getByRole("group", { name: "Período" }));
    expect(periods.getByRole("link", { name: "7 dias" })).toHaveAttribute("aria-current", "true");
    expect(periods.getByRole("link", { name: "Hoje" })).toHaveAttribute("href", "/dashboard?periodo=hoje&unidade=branch-centro");
    expect(screen.getByText(/^Nos últimos 7 dias entraram 180 leads\./)).toBeInTheDocument();
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
  it("mostra um card por plantão ativo, com esperando, distribuídos e corretores confirmados", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const duties = section("plantoes");
    expect(duties.getByRole("link", { name: "Ver escala" })).toHaveAttribute("href", "/leads/distribuicao?view=plantao");
    const pme = duties.getByRole("link", { name: /Plantão PME/ });
    expect(pme).toHaveAttribute("href", "/leads/distribuicao/plantao/pme");
    const figure = (duty: HTMLElement, label: string) => within(duty).getByText(label).parentElement?.querySelector("strong")?.textContent;
    expect(figure(pme, "esperando")).toBe("6");
    expect(figure(pme, "distribuídos")).toBe("9");
    // PME tem 2 corretores confirmados de 3 escalados: em alerta (e no "Precisa de você") por estar abaixo do mínimo.
    expect(figure(pme, "abaixo do mínimo")).toBe("2/3");
    expect(within(pme).queryByText("confirmados")).not.toBeInTheDocument();
    expect(within(pme).getByText("08:00 às 19:00")).toBeInTheDocument();
    const presencial = duties.getByRole("link", { name: /Plantão Presencial/ });
    expect(presencial).toHaveAttribute("href", "/leads/distribuicao/plantao/presencial");
    expect(figure(presencial, "esperando")).toBe("0");
    expect(figure(presencial, "distribuídos")).toBe("4");
    expect(figure(presencial, "confirmados")).toBe("3/3");
    // No celular, o mesmo plantão numa linha só.
    expect(section("m-plantoes").getByRole("link", { name: /Plantão PME/ })).toHaveTextContent("6 esperando · 9 distribuídos · 2/3 corretores, abaixo do mínimo");
  });

  it("sem plantão ativo, mostra o estado vazio com o próximo plantão", () => {
    const data = { ...emptyEssential(NOW), duties: { running: [], next: { scheduleId: "x", name: "Plantão Noturno", dutyDate: "2026-10-26", startsAt: "19:00", endsAt: "23:00", running: false, queueName: null, brokerCount: 0, minimumBrokers: 1 } } };
    render(<DirectorLiteDashboard data={data} period="today" branchId={null} branches={[]} now={NOW} />);
    for (const id of ["plantoes", "m-plantoes"]) {
      expect(section(id).getByText(/Nenhum plantão ativo\. Próximo: Plantão Noturno, 26\/10 às 19:00\./)).toBeInTheDocument();
    }
  });
});

describe("bloco 2: leads por fila", () => {
  it("mostra a janela do dia na nota das temperaturas (sábado vem da sexta 19h)", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(section("m-filas").getByText("Quentes, mornos e frios de quem entrou desde sex 19h")).toBeInTheDocument();
  });

  it("tem uma linha por fila com entraram, qualificados, frios e na IA, a temperatura e o total", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const table = within(screen.getByRole("table", { name: "Leads por fila" }));
    expect(table.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Fila", "Entraram", "Qualificados", "Frios", "Na IA", "Temperatura"]);
    const cells = (name: string) => within(table.getByRole("row", { name: new RegExp(`^${name}`) })).getAllByRole("cell").slice(1, 5).map((cell) => cell.textContent);
    expect(cells("Fila Tatiana")).toEqual(["26", "15", "7", "4"]);
    expect(cells("PF Renan")).toEqual(["10", "5", "5", "0"]);
    expect(cells("Total")).toEqual(["36", "20", "12", "4"]);
    expect(table.getByRole("link", { name: "Fila Tatiana" })).toHaveAttribute("href", "/leads?fila=tatiana");
    expect(table.getByLabelText("9 quentes, 6 mornos, 7 frios")).toBeInTheDocument();
  });

  it("sem leads na janela, o estado vazio aparece no lugar das filas", () => {
    render(<DirectorLiteDashboard data={emptyEssential(NOW)} period="today" branchId={null} branches={[]} now={NOW} />);
    expect(within(screen.getByRole("table", { name: "Leads por fila" })).getByText("Nenhum lead entrou no período.")).toBeInTheDocument();
    expect(section("m-filas").getByText("Nenhum lead entrou no período.")).toBeInTheDocument();
  });
});

describe("entradas por hora", () => {
  it("mostra WhatsApp x formulário das 06h às 19h, com o pico e a hora de agora", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const hours = section("horas");
    expect(hours.getByRole("img", { name: "Entradas por hora, das 06h às 19h; o pico foi às 15h" })).toBeInTheDocument();
    for (const label of ["WhatsApp", "Formulário", "Agora"]) expect(hours.getByText(label)).toBeInTheDocument();
    // 16h42 UTC são 13h em Brasília.
    expect(hours.getByText("13h")).toHaveAttribute("data-now", "true");
    expect(hours.getByText("06h")).not.toHaveAttribute("data-now");
  });

  it("fora de hoje não marca a hora de agora; sem entradas, não fala de pico", () => {
    render(<DirectorLiteDashboard data={emptyEssential(NOW)} period="7d" branchId={null} branches={[]} now={NOW} />);
    const hours = section("horas");
    expect(hours.getByRole("img", { name: "Entradas por hora, das 06h às 19h" })).toBeInTheDocument();
    expect(hours.queryByText("Agora")).not.toBeInTheDocument();
  });
});

describe("bloco 3: WhatsApp dos corretores", () => {
  it("mostra quantos conectaram, recebidas, a taxa de resposta e quantas em atendimento", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const card = section("whats");
    expect(card.getByText("3 de 5 conectados")).toBeInTheDocument();
    const figure = (label: string) => card.getByText(label).parentElement?.querySelector("strong")?.textContent;
    expect(figure("recebidas")).toBe("35");
    expect(figure("respondidas")).toBe("37%");
    expect(figure("em atendimento")).toBe("8");
    expect(section("m-whats").getByText("3 de 5 corretores com WhatsApp conectado")).toBeInTheDocument();
  });

  it("no cartão, só os conectados, ordenados por atendimentos ativos, com link para as conversas; sem botão quando cabem todos", () => {
    render(<DirectorLiteDashboard data={buildEssential("today", "all", NOW)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const links = within(screen.getByRole("list", { name: "Corretores com mais atendimentos" })).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("title"))).toEqual(["Ver conversas de Ana Souza", "Ver conversas de Carla Dias", "Ver conversas de Bruno Lima"]);
    expect(links[0]).toHaveAttribute("href", "/conversas?tab=leads&brokerId=ana");
    expect(screen.queryByText("Diego Reis")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver todos os corretores/ })).not.toBeInTheDocument();
  });

  it("com mais de 4 conectados, o cartão mostra os 4 primeiros e o painel lateral lista todos na mesma ordem", () => {
    render(<DirectorLiteDashboard data={withBrokers(MANY_BROKERS)} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const order = ["Fábio Rocha", "Ana Souza", "Carla Dias", "Gabriela Nunes", "Bruno Lima", "Hugo Prado"].map((name) => `Ver conversas de ${name}`);
    const card = within(screen.getByRole("list", { name: "Corretores com mais atendimentos" }));
    expect(card.getAllByRole("link").map((link) => link.getAttribute("title"))).toEqual(order.slice(0, 4));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver todos os corretores (6)" }));
    const panel = within(screen.getByRole("dialog", { name: "WhatsApp dos corretores" }));
    expect(panel.getByText("6 de 7 conectados, por atendimentos ativos.")).toBeInTheDocument();
    expect(panel.getAllByRole("link").map((link) => link.getAttribute("title"))).toEqual(order);
    expect(screen.queryByText("Diego Reis")).not.toBeInTheDocument();
  });

  it("nenhum corretor com WhatsApp pessoal: estado vazio no lugar da lista, sem a contagem de conectados", () => {
    render(<DirectorLiteDashboard data={emptyEssential(NOW)} period="today" branchId={null} branches={[]} now={NOW} />);
    const card = section("whats");
    expect(card.getByText("Nenhum corretor com WhatsApp pessoal.")).toBeInTheDocument();
    expect(card.queryByText(/0 de 0/)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Corretores com mais atendimentos" })).not.toBeInTheDocument();
  });

  it("com corretores mas nenhum conectado, o estado vazio diz que ninguém está conectado agora", () => {
    render(<DirectorLiteDashboard data={withBrokers([MANY_BROKERS[6]!])} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const card = section("whats");
    expect(card.getByText("Nenhum corretor conectado agora.")).toBeInTheDocument();
    expect(card.getByText("0 de 1 conectados")).toBeInTheDocument();
  });
});

describe("movimento", () => {
  it("com movimento reduzido (do sistema ou do site), o CSS desliga toda animação do painel", () => {
    const css = readFileSync(join(__dirname, "painel.module.css"), "utf8");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.in, \.bar, \.segFill, \.working, \.popover \{ animation: none; \}/);
    expect(css).toContain(':global(html[data-reduce-motion="1"]) .gx :is(.in, .bar, .segFill, .working, .popover) { animation: none; }');
  });

  it("os números entram em sequência, com atraso crescente, dentro do escopo das animações", () => {
    const { container } = render(<DirectorLiteDashboard data={buildEssential("30d", "all", NOW)} period="30d" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(container.querySelector('[data-painel="lite"]')).toHaveClass(styles.gx);
    const kpis = ["Entraram", "Qualificados", "Distribuídos", "Vendas"].map(kpiCard);
    for (const kpi of kpis) expect(kpi).toHaveClass(styles.in);
    expect(kpis.map((kpi) => kpi.style.animationDelay)).toEqual(["160ms", "200ms", "240ms", "280ms"]);
  });

  it("os números aparecem prontos em texto, sem odômetro de dígitos", () => {
    const { container } = render(<DirectorLiteDashboard data={buildEssential("30d", "all", NOW)} period="30d" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(container.querySelectorAll('span[style*="inline-flex"]')).toHaveLength(0);
    // 30 dias: o total de entradas do exemplo é 576 (36 x 16).
    expect(kpiCard("Entraram").querySelector("p")).toHaveTextContent(/^576$/);
  });

  it("agrupa o milhar em pt-BR nas contagens por corretor e nos totais do WhatsApp", () => {
    const [first, ...rest] = MANY_BROKERS;
    const big = withBrokers([{ ...first!, received: 1234, responding: 1000, active: 2345 }, ...rest]);
    render(<DirectorLiteDashboard data={big} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(within(screen.getByRole("list", { name: "Corretores com mais atendimentos" })).getByText("2.345")).toBeInTheDocument();
    // 1.234 + 12 + 9 + 8 + 5 + 3 recebidas.
    expect(section("whats").getByText("recebidas").parentElement?.querySelector("strong")).toHaveTextContent("1.271");
    fireEvent.click(screen.getByRole("button", { name: /Ver todos os corretores/ }));
    expect(within(screen.getByRole("dialog", { name: "WhatsApp dos corretores" })).getByText("2.345")).toBeInTheDocument();
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

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArcScopeProvider } from "@/components/arc/arc-scope-context";

import { LeadsFilters } from "./leads-filters";

const params = { current: new URLSearchParams() };
const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push, refresh: vi.fn() }),
  useSearchParams: () => params.current,
  usePathname: () => "/leads",
}));

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/leads");
});

afterEach(() => {
  cleanup();
  replace.mockReset();
  params.current = new URLSearchParams();
});

const props = {
  storageKey: "teste:filtros",
  branches: [{ id: "b1", name: "Centro" }, { id: "b2", name: "Niterói 1" }],
  brokers: [{ id: "c1", name: "Ana Souza" }, { id: "c2", name: "Bruno Lima" }],
  tags: [{ id: "t1", name: "VIP", colorHue: 120 }],
};

function renderLite(extra: Partial<Parameters<typeof LeadsFilters>[0]> = {}) {
  return render(
    <ArcScopeProvider enabled>
      <LeadsFilters {...props} {...extra} />
    </ArcScopeProvider>,
  );
}

const lastTarget = () => String(replace.mock.calls.at(-1)?.[0]);

describe("filtros Lite de /leads (chave ligada)", () => {
  it("troca a tela atual pela Lite só com a chave", () => {
    const { container } = renderLite();
    expect(container.querySelector('[data-skin="diretor"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="canonical-filter-bar"]')).toBeNull();
  });

  it("escolhe filial e corretor no painel e só aplica no botão, com os mesmos parâmetros", () => {
    window.history.replaceState(null, "", "/leads?view=kanban&page=3");
    renderLite();
    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    const panel = screen.getByRole("dialog", { name: "Filtros da fila" });

    // Desenho 1:1 do artifact (27/11/2026): cada filtro do painel é um seletor em pílula com o rótulo em cima.
    fireEvent.change(within(panel).getByRole("combobox", { name: /^Filial/ }), { target: { value: "b2" } });
    fireEvent.change(within(panel).getByRole("combobox", { name: /^Corretor/ }), { target: { value: "c2" } });
    fireEvent.change(within(panel).getByRole("combobox", { name: /^Tipo de lead/ }), { target: { value: "PJ" } });
    fireEvent.change(within(panel).getByRole("combobox", { name: /^Itens por página/ }), { target: { value: "50" } });
    expect(replace).not.toHaveBeenCalled();

    fireEvent.click(within(panel).getByRole("button", { name: "Aplicar filtros" }));
    const target = new URL(lastTarget(), "http://x");
    expect(target.pathname).toBe("/leads");
    expect(target.searchParams.get("branch")).toBe("b2");
    expect(target.searchParams.get("corretor")).toBe("c2");
    expect(target.searchParams.get("tipo")).toBe("PJ");
    expect(target.searchParams.get("pageSize")).toBe("50");
    expect(target.searchParams.get("view")).toBe("kanban");
    expect(target.searchParams.has("page")).toBe(false);
    expect(JSON.parse(window.localStorage.getItem("teste:filtros") ?? "{}")).toMatchObject({ branch: "b2", corretor: "c2" });
    expect(screen.queryByRole("dialog", { name: "Filtros da fila" })).not.toBeInTheDocument();
  });

  it("etapa vira um seletor na barra que aplica na hora, com o mesmo ?status=", () => {
    renderLite();
    expect(screen.queryByRole("group", { name: "Etapas" })).not.toBeInTheDocument();
    const stage = screen.getByRole("combobox", { name: "Etapa" });
    fireEvent.change(stage, { target: { value: "converted" } });
    expect(lastTarget()).toBe("/leads?status=converted");
    expect(stage).toHaveDisplayValue("Convertidos");
  });

  it("fila e período viram seletores com contagem e os mesmos ?fila= e ?period=", () => {
    renderLite({
      queueTabs: { tabs: [{ value: "", label: "Todas", count: 3966 }, { value: "q1", label: "FILA TATIANA", count: 1774 }, { value: "q2", label: "FILA PF - RENAN", count: 912 }], current: "" },
      period: 30,
    });
    const queue = screen.getByRole("combobox", { name: "Fila" });
    expect(within(queue).getByRole("option", { name: /FILA TATIANA/ })).toHaveTextContent("1.774");
    fireEvent.change(queue, { target: { value: "q1" } });
    expect(push).toHaveBeenLastCalledWith("/leads?fila=q1", { scroll: false });
    fireEvent.change(screen.getByRole("combobox", { name: "Período" }), { target: { value: "7" } });
    expect(lastTarget()).toBe("/leads?period=7");
  });

  it("busca aplica no Enter preservando os demais filtros", () => {
    params.current = new URLSearchParams("branch=b1");
    window.history.replaceState(null, "", "/leads?branch=b1");
    renderLite({ initialBranch: "b1" });
    const input = screen.getByRole("searchbox", { name: "Buscar" });
    fireEvent.change(input, { target: { value: "Maria" } });
    fireEvent.submit(input.closest("form")!);
    expect(lastTarget()).toBe("/leads?branch=b1&search=Maria");
  });

  it("filtros ativos viram chips removíveis e Limpar tudo volta para /leads", () => {
    params.current = new URLSearchParams("branch=b1&qualification=hot&tag=t1");
    window.history.replaceState(null, "", "/leads?branch=b1&qualification=hot&tag=t1");
    window.localStorage.setItem("teste:filtros", "{}");
    renderLite({ initialBranch: "b1", initialQualification: "hot", initialTag: "t1" });
    const active = within(screen.getByRole("group", { name: "Filtros ativos" }));
    expect(active.getByRole("button", { name: "Remover filtro Qualificação: Quente" })).toBeInTheDocument();
    expect(active.getByRole("button", { name: "Remover filtro Tag: VIP" })).toBeInTheDocument();
    fireEvent.click(active.getByRole("button", { name: "Remover filtro Filial: Centro" }));
    expect(lastTarget()).toBe("/leads?qualification=hot&tag=t1");
    expect(screen.getByRole("button", { name: /Filtros/ })).toHaveTextContent("2");

    fireEvent.click(screen.getByRole("button", { name: /Limpar tudo/ }));
    expect(lastTarget()).toBe("/leads");
    expect(window.localStorage.getItem("teste:filtros")).toBeNull();
  });

  it("o fim da barra ainda aceita um conteúdo extra (trailing)", () => {
    renderLite({ trailing: <nav aria-label="Visão">abas</nav> });
    const bar = screen.getByRole("search").parentElement!;
    expect(bar).toContainElement(screen.getByRole("navigation", { name: "Visão" }));
    expect(bar).toContainElement(screen.getByRole("button", { name: /Filtros/ }));
  });

  it("corretor não vê origem nem campanhas Meta", () => {
    renderLite({ hideOriginFilters: true });
    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    const panel = within(screen.getByRole("dialog", { name: "Filtros da fila" }));
    expect(panel.queryByText("Origem da oportunidade")).not.toBeInTheDocument();
    expect(panel.queryByRole("combobox", { name: /Campanhas Meta/ })).not.toBeInTheDocument();
    expect(panel.getByRole("combobox", { name: /^Etapa/ })).toBeInTheDocument();
  });

  it("Esc fecha o painel e devolve o foco ao botão Filtros", () => {
    renderLite();
    const trigger = screen.getByRole("button", { name: /Filtros/ });
    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Filtros da fila" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("restaura os filtros guardados quando a URL chega sem filtro", () => {
    window.localStorage.setItem("teste:filtros", JSON.stringify({ branch: "b1", pageSize: "20" }));
    renderLite();
    expect(replace).toHaveBeenCalledWith("/leads?branch=b1", { scroll: false });
  });

  it("'Com tarefa atrasada' liga e desliga o ?tarefa=atrasada na hora", () => {
    params.current = new URLSearchParams("view=kanban&page=2");
    renderLite();
    const toggle = screen.getByRole("button", { name: "Com tarefa atrasada" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(push).toHaveBeenLastCalledWith("/leads?view=kanban&tarefa=atrasada", { scroll: false });
    cleanup();
    params.current = new URLSearchParams("tarefa=atrasada");
    renderLite();
    const pressed = screen.getByRole("button", { name: "Com tarefa atrasada" });
    expect(pressed).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(pressed);
    expect(push).toHaveBeenLastCalledWith("/leads", { scroll: false });
  });
});

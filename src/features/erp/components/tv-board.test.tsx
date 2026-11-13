// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { ErpSkinProvider } from "../ui/skin-context";
import type { ErpSkin } from "../ui/skin";
import type { TvTile } from "../tv";
import { TvBoard } from "./tv-board";

afterEach(cleanup);
beforeAll(() => {
  window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia;
});

const tiles: TvTile[] = [
  { id: "production-count", kind: "number", label: "Vendas no mês", value: "12", hint: "Vendas ativas pela data da venda" },
  { id: "implanted", kind: "number", label: "Implantações no mês", value: "4", hint: "Implantações concluídas" },
  { id: "units", kind: "ranking", label: "Unidades com mais vendas", hint: "Vendas ativas no mês", items: [{ label: "Centro", value: "7", amount: 7 }, { label: "Norte", value: "3", amount: 3 }] },
];
const ranking = (id: string): TvTile => ({ id, kind: "ranking", label: `Ranking ${id}`, hint: "Vendas ativas no mês", items: [{ label: `Item ${id}`, value: "1", amount: 1 }] });

describe.each<ErpSkin>(["standard", "lite"])("TvBoard (%s skin)", (skin) => {
  const mount = (list: TvTile[]) => render(<ErpSkinProvider skin={skin}><TvBoard tiles={list} intervalSeconds={20} generatedAt={new Date().toISOString()} month="2026-11" /></ErpSkinProvider>);

  it("shows every number and ranking at once, with the month and the update time", () => {
    mount(tiles);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Centro")).toBeInTheDocument();
    expect(screen.getByText("Novembro de 2026")).toBeInTheDocument();
    expect(screen.getByText(/Atualizado às/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pausar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Tela cheia" })).toBeInTheDocument();
  });

  it("rotates only the rankings when there are more than fit, and can pause", () => {
    mount([...tiles, ranking("a"), ranking("b")]);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.queryByText("Item b")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    expect(screen.getByRole("button", { name: "Retomar" })).toHaveAttribute("aria-pressed", "true");
  });
});

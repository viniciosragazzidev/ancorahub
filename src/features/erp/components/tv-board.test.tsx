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
  { id: "units", kind: "ranking", label: "Unidades com mais vendas", hint: "Vendas ativas no mês", items: [{ label: "Centro", value: "7" }] },
];

describe.each<ErpSkin>(["standard", "lite"])("TvBoard (%s skin)", (skin) => {
  it("shows the current tile with design-system type and lets the viewer pick another", () => {
    render(<ErpSkinProvider skin={skin}><TvBoard tiles={tiles} intervalSeconds={20} generatedAt={new Date().toISOString()} month="2026-11" /></ErpSkinProvider>);
    const value = screen.getByText("12");
    expect(value.className).toContain("text-ds-display");
    expect(value.className).not.toMatch(/text-[6-9]xl/);
    fireEvent.click(screen.getByRole("button", { name: "Unidades com mais vendas" }));
    expect(screen.getByText("Centro")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retomar" })).toHaveAttribute("aria-pressed", "true");
  });
});

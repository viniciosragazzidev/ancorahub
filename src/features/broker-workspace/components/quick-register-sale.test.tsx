// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listAction = vi.hoisted(() => vi.fn());
vi.mock("../quick-sale-actions", () => ({ listQuickSaleLeadsAction: listAction }));
vi.mock("@/components/arc/button/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => {
    const { variant, ...buttonProps } = props;
    return <button data-variant={variant} {...buttonProps}>{children}</button>;
  },
}));
vi.mock("@/components/arc/search-field/search-field", () => ({
  SearchField: ({ label, value, onValueChange, clearLabel, ...props }: { label: string; value: string; clearLabel?: string; onValueChange: (value: string) => void } & InputHTMLAttributes<HTMLInputElement>) => {
    void clearLabel;
    return <input type="search" aria-label={label} value={value} onChange={(event) => onValueChange(event.target.value)} {...props} />;
  },
}));
vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({
  BottomSheet: ({ title, description, children, open }: { title: string; description?: string; children: ReactNode; open?: boolean }) => (
    open ? <section aria-label={title}><h2>{title}</h2><p>{description}</p>{children}</section> : null
  ),
}));

import { QUICK_SALE_SEARCH_DELAY_MS, QuickRegisterSaleSheet } from "./quick-register-sale";

async function flush() {
  await act(async () => { await vi.runAllTimersAsync(); });
}

beforeEach(() => {
  vi.useFakeTimers();
  listAction.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Registrar venda em dois toques", () => {
  it("lista os leads em negociação com etapa e leva à tela do lead com o atalho", async () => {
    listAction.mockResolvedValue({ ok: true, leads: [
      { id: "lead-1", name: "Ana Souza", status: "under_analysis" },
      { id: "lead-2", name: "Bruno Lima", status: "quote_sent" },
    ] });
    render(<QuickRegisterSaleSheet open onOpenChange={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Registrar venda" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Carregando leads" })).toBeTruthy();
    await flush();
    expect(listAction).toHaveBeenCalledWith({ query: "" });
    const ana = screen.getByRole("link", { name: /Ana Souza/ });
    expect(ana.getAttribute("href")).toBe("/leads/lead-1?registrar-venda=1");
    expect(ana.textContent).toContain("Em análise");
    expect(ana.textContent).toContain("AS");
    expect(screen.getByRole("link", { name: /Bruno Lima/ }).textContent).toContain("Cotação enviada");
  });

  it("busca no servidor depois de uma pausa na digitação", async () => {
    listAction.mockResolvedValue({ ok: true, leads: [] });
    render(<QuickRegisterSaleSheet open onOpenChange={vi.fn()} />);
    await flush();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar lead" }), { target: { value: "Ana" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(QUICK_SALE_SEARCH_DELAY_MS - 50); });
    expect(listAction).toHaveBeenCalledTimes(1);
    await flush();
    expect(listAction).toHaveBeenLastCalledWith({ query: "Ana" });
    expect(screen.getByText("Nenhum lead encontrado")).toBeTruthy();
  });

  it("mostra o vazio sem busca", async () => {
    listAction.mockResolvedValue({ ok: true, leads: [] });
    render(<QuickRegisterSaleSheet open onOpenChange={vi.fn()} />);
    await flush();
    expect(screen.getByText("Nenhum lead em negociação")).toBeTruthy();
  });

  it("mostra o erro e tenta de novo", async () => {
    listAction.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: true, leads: [{ id: "lead-1", name: "Ana Souza", status: "negotiation" }] });
    render(<QuickRegisterSaleSheet open onOpenChange={vi.fn()} />);
    await flush();
    expect(screen.getByRole("alert").textContent).toContain("Não deu para carregar seus leads");
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await flush();
    expect(listAction).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("link", { name: /Ana Souza/ })).toBeTruthy();
  });

  it("não busca nada com a folha fechada", async () => {
    render(<QuickRegisterSaleSheet open={false} onOpenChange={vi.fn()} />);
    await flush();
    expect(listAction).not.toHaveBeenCalled();
  });
});

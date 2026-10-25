// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LiteBulkBar, LiteConfirmDialog, LiteFilterChips } from "./index";

afterEach(cleanup);

describe("LiteFilterChips", () => {
  const chips = [
    { id: "quentes", label: "Quentes", count: 4 },
    { id: "frios", label: "Frios", count: 2 },
  ];

  it("marca o chip ativo com aria-pressed e avisa a troca", () => {
    const onToggle = vi.fn();
    render(<LiteFilterChips label="Temperatura" chips={chips} active={["quentes"]} onToggle={onToggle} />);
    const group = within(screen.getByRole("group", { name: "Temperatura" }));
    const quentes = group.getByRole("button", { name: /Quentes/ });
    expect(quentes).toHaveAttribute("aria-pressed", "true");
    expect(quentes).toHaveTextContent("4");
    expect(group.getByRole("button", { name: /Frios/ })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(group.getByRole("button", { name: /Frios/ }));
    expect(onToggle).toHaveBeenCalledWith("frios");
  });
});

describe("LiteBulkBar", () => {
  it("some sem seleção", () => {
    const { container } = render(<LiteBulkBar count={0} actions={[]} onClear={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("fala no singular e no plural e roda as ações", () => {
    const run = vi.fn();
    const { rerender } = render(<LiteBulkBar count={1} actions={[{ id: "dist", label: "Distribuir", onRun: run }]} onClear={() => {}} />);
    expect(screen.getByText("1 selecionado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Distribuir" }));
    expect(run).toHaveBeenCalledTimes(1);
    rerender(<LiteBulkBar count={3} actions={[{ id: "del", label: "Excluir", onRun: run, tone: "danger" }]} onClear={() => {}} />);
    expect(screen.getByText("3 selecionados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir" })).toHaveAttribute("data-tone", "danger");
  });

  it("limpa a seleção pelo botão", () => {
    const clear = vi.fn();
    render(<LiteBulkBar count={2} actions={[]} onClear={clear} />);
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));
    expect(clear).toHaveBeenCalledTimes(1);
  });
});

describe("LiteConfirmDialog", () => {
  it("não aparece fechado", () => {
    render(<LiteConfirmDialog open={false} title="Excluir lead?" confirmLabel="Excluir" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("foca Cancelar ao abrir, confirma e cancela", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    render(<LiteConfirmDialog open title="Excluir lead?" description="Esta ação não pode ser desfeita." confirmLabel="Excluir" tone="danger" onConfirm={confirm} onCancel={cancel} />);
    const dialog = screen.getByRole("alertdialog", { name: "Excluir lead?" });
    expect(dialog).toHaveAccessibleDescription("Esta ação não pode ser desfeita.");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("Esc fecha pelo cancelar", () => {
    const cancel = vi.fn();
    render(<LiteConfirmDialog open title="Sair?" confirmLabel="Sair" onConfirm={() => {}} onCancel={cancel} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

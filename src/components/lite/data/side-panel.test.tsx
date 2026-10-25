// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LiteSidePanel } from "./side-panel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Editar lead</button>
      <LiteSidePanel open={open} onOpenChange={setOpen} title="Editar lead" description="Os dados mudam para toda a equipe.">
        <label>Nome <input defaultValue="Maria" /></label>
        <button type="button">Salvar alterações</button>
      </LiteSidePanel>
    </>
  );
}

describe("LiteSidePanel", () => {
  it("abre como diálogo nomeado, foca o primeiro campo e fecha no Esc devolvendo o foco", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Editar lead" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Editar lead" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Os dados mudam para toda a equipe.");
    expect(screen.getByRole("textbox", { name: "Nome" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("prende o Tab dentro do painel e fecha pelo botão", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Editar lead" }));
    const close = screen.getByRole("button", { name: "Fechar painel" });
    const save = screen.getByRole("button", { name: "Salvar alterações" });
    save.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(save).toHaveFocus();
    fireEvent.click(close);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("no celular abre no BottomSheet", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Editar lead" }));
    expect(screen.getByRole("dialog", { name: "Editar lead" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fechar painel" })).not.toBeInTheDocument();
  });
});

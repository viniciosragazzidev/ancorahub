// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KeyboardShortcutsProvider, useShortcuts } from "./keyboard-shortcuts-provider";

afterEach(() => cleanup());

function RegisterDashboardShortcut({ handler }: { handler: () => void }) {
  const { register } = useShortcuts();
  useEffect(() => register({ id: "director-dashboard-shortcut", label: "Início", keys: "g d", handler }), [handler, register]);
  return null;
}

describe("atalhos do chrome do diretor", () => {
  it("mantém as sequências de navegação g ativas com o skin", async () => {
    const handler = vi.fn();
    render(
      <KeyboardShortcutsProvider directorLiteEnabled>
        <RegisterDashboardShortcut handler={handler} />
      </KeyboardShortcutsProvider>,
    );

    await waitFor(() => fireEvent.keyDown(document, { key: "g" }));
    fireEvent.keyDown(document, { key: "d" });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("preserva o escopo Arc no elemento raiz do diálogo", () => {
    render(<KeyboardShortcutsProvider directorLiteEnabled><div /></KeyboardShortcutsProvider>);
    fireEvent.keyDown(document, { key: "?" });

    const dialog = document.querySelector('[data-slot="keyboard-shortcuts-dialog"]');
    expect(dialog).toHaveClass("arc-venancor");
    expect(dialog).toHaveAttribute("data-skin", "diretor");
  });
});

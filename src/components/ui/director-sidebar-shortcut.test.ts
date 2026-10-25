// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { handleDirectorSidebarShortcut } from "./director-sidebar-shortcut";

describe("atalho da sidebar da diretoria", () => {
  it("Ctrl+B alterna a navegação e previne a ação do navegador", () => {
    const toggleSidebar = vi.fn();
    const event = new KeyboardEvent("keydown", { key: "b", ctrlKey: true, cancelable: true });

    expect(handleDirectorSidebarShortcut(event, toggleSidebar)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(toggleSidebar).toHaveBeenCalledOnce();
  });

  it("não intercepta digitação em campos", () => {
    const input = document.createElement("input");
    const event = new KeyboardEvent("keydown", { key: "b", ctrlKey: true, cancelable: true });
    Object.defineProperty(event, "target", { value: input });
    const toggleSidebar = vi.fn();

    expect(handleDirectorSidebarShortcut(event, toggleSidebar)).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    expect(toggleSidebar).not.toHaveBeenCalled();
  });
});

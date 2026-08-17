// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/theme-provider", () => ({ ThemeProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/pwa-install-prompt", () => ({ PwaInstallPrompt: () => null }));
vi.mock("@/components/keyboard-shortcuts-provider", () => ({
  KeyboardShortcutsProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/keyboard-shortcuts", () => ({ useRegisterDefaultShortcuts: () => undefined }));

import { AppProviders } from "./app-providers";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AppProviders", () => {
  it("preserves the registered service worker required by browser push", async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const update = vi.fn().mockResolvedValue(undefined);
    const register = vi.fn().mockResolvedValue({ update, unregister });
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register } });

    render(<AppProviders><div>CRM</div></AppProviders>);

    await waitFor(() => expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" }));
    expect(update).toHaveBeenCalledTimes(1);
    expect(unregister).not.toHaveBeenCalled();
  });
});

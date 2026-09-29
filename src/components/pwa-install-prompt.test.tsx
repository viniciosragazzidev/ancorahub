// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PwaInstallPrompt } from "./pwa-install-prompt";

function mockMediaQuery(query: string) {
  const matches = query === "(pointer: coarse)" || query === "(max-width: 767px)";
  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
}

describe("PwaInstallPrompt", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn(mockMediaQuery));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mantém o botão disponível no mobile mesmo sem o evento nativo de instalação", async () => {
    render(<PwaInstallPrompt />);

    const installButton = await screen.findByRole("button", { name: "Instalar CorreTop" });
    fireEvent.click(installButton);

    expect(screen.getByText(/Abra o menu do navegador/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Como fazer" })).toBeInTheDocument();
  });

  it("usa o prompt nativo quando o navegador o disponibiliza", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
    };
    event.prompt = prompt;
    event.userChoice = Promise.resolve({ outcome: "accepted" });

    render(<PwaInstallPrompt />);
    act(() => window.dispatchEvent(event));

    fireEvent.click(await screen.findByRole("button", { name: "Instalar CorreTop" }));
    fireEvent.click(screen.getByRole("button", { name: "Instalar" }));

    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
  });
});

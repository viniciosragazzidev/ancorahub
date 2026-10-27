// @vitest-environment jsdom
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LiteLiveStatusStrip } from "./live-status";
import type { LiveStatus } from "./types";
import { resetCountdownClockForTests } from "./use-countdown";

// Hidratação com o motion real (o setup global troca por um mock de texto).
vi.unmock("motion/react");
vi.stubGlobal("matchMedia", (media: string) => ({ matches: false, media, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
  resetCountdownClockForTests();
  vi.restoreAllMocks();
});

const status: LiveStatus = {
  id: "ofertas",
  label: "Ofertas aguardando aceite",
  value: 3,
  emptyText: "Nenhuma oferta aguardando aceite",
  severity: "atencao",
  nextEvent: { at: "2026-10-27T13:02:41.000Z", label: "A primeira expira" },
  explanation: "Se o corretor não aceitar, o lead vai para o próximo da fila.",
  generatedAt: "2026-10-27T13:00:00.000Z",
};

describe("status vivo: hidratação", () => {
  it("o HTML do servidor hidrata sem erro mesmo com o relógio do cliente em outra hora", async () => {
    const element = <LiteLiveStatusStrip statuses={[status]} />;
    const html = renderToString(element);
    expect(html).toContain("A primeira expira às 10:02");

    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    await act(async () => {
      hydrateRoot(container, element);
    });
    expect(errors).not.toHaveBeenCalled();
    // Depois da hidratação o relógio do cliente assume (aqui, o relógio real: muito depois do dado).
    // O texto antigo sai com fade (LiteSwap) enquanto o novo entra: basta o novo estar lá.
    expect([...container.querySelectorAll('[role="timer"]')].some((timer) => timer.textContent === "Rodando agora")).toBe(true);
  });
});

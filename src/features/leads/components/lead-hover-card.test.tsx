// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatLastActivity, LeadHoverCardContent, LeadNameHoverCard, leadStatusTone, pipelineStep } from "./lead-hover-card";

function mockPointer(fine: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: fine && query.includes("pointer: fine"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("formatLastActivity", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  it("diz agora para menos de um minuto", () => {
    expect(formatLastActivity(new Date("2026-11-20T11:59:30Z"), now)).toBe("agora");
  });
  it("traço quando não há data ou é inválida", () => {
    expect(formatLastActivity(null, now)).toBe("—");
    expect(formatLastActivity("xx", now)).toBe("—");
  });
});

describe("leadStatusTone", () => {
  it("mapeia etapas para os tons do DsStatusBadge", () => {
    expect(leadStatusTone("converted")).toBe("success");
    expect(leadStatusTone("lost")).toBe("destructive");
    expect(leadStatusTone("awaiting_reply")).toBe("pending");
    expect(leadStatusTone("new")).toBe("info");
    expect(leadStatusTone("desconhecido")).toBe("secondary");
    expect(leadStatusTone(null)).toBe("secondary");
  });
});

describe("pipelineStep", () => {
  it("posição no funil; perdido fica fora", () => {
    expect(pipelineStep("new")).toEqual({ step: 1, total: 8 });
    expect(pipelineStep("negotiation")).toEqual({ step: 5, total: 8 });
    expect(pipelineStep("converted")).toEqual({ step: 8, total: 8 });
    expect(pipelineStep("lost")).toBeNull();
  });
});

describe("LeadHoverCardContent", () => {
  it("mostra o essencial e os atalhos", () => {
    const onOpen = vi.fn();
    render(
      <LeadHoverCardContent
        lead={{ id: "1", name: "Carla Mendes", status: "negotiation", phone: "5521998836148", product: "PME", monthlyValue: 1890.5, brokerName: "Vinicios", nextAction: "Retorno hoje 15h" }}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByText("Negociação")).toBeTruthy();
    expect(screen.getByText("(21) 99883-6148")).toBeTruthy();
    expect(screen.getByText("PME")).toBeTruthy();
    expect(screen.getByText(/1\.890,50/)).toBeTruthy();
    expect(screen.getByText("Vinicios")).toBeTruthy();
    expect(screen.getByText("Retorno hoje 15h")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ligar/ }).getAttribute("href")).toBe("tel:5521998836148");
    fireEvent.click(screen.getByRole("button", { name: "Abrir ficha" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("sem telefone não oferece WhatsApp nem Ligar; dados ausentes viram traço", () => {
    render(<LeadHoverCardContent lead={{ id: "2", name: "Roberto", brokerName: null }} href="/leads/2" />);
    expect(screen.queryByText("WhatsApp")).toBeNull();
    expect(screen.queryByText("Ligar")).toBeNull();
    expect(screen.getByText("Sem corretor")).toBeTruthy();
    expect(screen.queryByText("Próximo passo")).toBeNull();
    expect(screen.getByRole("link", { name: /Abrir ficha/ }).getAttribute("href")).toBe("/leads/2");
  });
});

describe("LeadNameHoverCard", () => {
  it("no toque devolve o nome sem prévia", () => {
    mockPointer(false);
    render(
      <LeadNameHoverCard lead={{ id: "1", name: "Carla" }}>
        <button type="button">Carla</button>
      </LeadNameHoverCard>,
    );
    const trigger = screen.getByRole("button", { name: "Carla" });
    act(() => { trigger.focus(); });
    expect(screen.queryByTestId("lead-hover-card")).toBeNull();
    expect(trigger.getAttribute("data-slot")).toBeNull();
  });

  it("com mouse abre no foco do teclado", async () => {
    mockPointer(true);
    render(
      <LeadNameHoverCard lead={{ id: "1", name: "Carla", status: "new" }}>
        <button type="button">Carla</button>
      </LeadNameHoverCard>,
    );
    const trigger = screen.getByRole("button", { name: "Carla" });
    expect(trigger.getAttribute("data-slot")).toBe("hover-preview-trigger");
    await act(async () => {
      fireEvent.focus(trigger);
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    expect(await screen.findByTestId("lead-hover-card")).toBeTruthy();
  });
});

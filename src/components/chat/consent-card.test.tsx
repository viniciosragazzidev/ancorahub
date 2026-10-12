// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const decide = vi.hoisted(() => vi.fn());
vi.mock("@/features/ai-gateway/consent-actions", () => ({ decideAiConsentAction: decide }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { ChatScreen } from "./chat-screen";

afterEach(() => { cleanup(); decide.mockReset(); });

function renderConsent(onFreeText = vi.fn().mockResolvedValue([{ type: "assistant", id: "ai", text: "Atenda a Maria primeiro." }])) {
  render(<ChatScreen identity={{ name: "Leads", shape: "mochi", hue: 212 }} backHref="/dashboard" script={{ blocks: [{ type: "consent", id: "c1", question: "Quem atendo primeiro?" }] }} onFreeText={onFreeText} />);
  return onFreeText;
}

describe("AI consent card", () => {
  it("Permitir records the consent and answers the waiting question", async () => {
    decide.mockResolvedValue({ ok: true });
    const onFreeText = renderConsent();
    expect(screen.getByText("Usar IA nas tarefas?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes" }));
    expect(screen.getByText("Em servidores fora do Brasil.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Permitir" }));
    expect(await screen.findByText("Atenda a Maria primeiro.")).toBeTruthy();
    expect(decide).toHaveBeenCalledWith("granted");
    expect(onFreeText).toHaveBeenCalledWith("Quem atendo primeiro?");
    expect(screen.getByText("✓ Permitido")).toBeTruthy();
  });

  it("Agora não records the refusal and sends nothing to the AI", async () => {
    decide.mockResolvedValue({ ok: true });
    const onFreeText = renderConsent();
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(await screen.findByText(/Tudo bem, sem IA/)).toBeTruthy();
    expect(decide).toHaveBeenCalledWith("declined");
    expect(onFreeText).not.toHaveBeenCalled();
  });

  it("keeps the buttons when saving fails", async () => {
    decide.mockResolvedValue({ ok: false });
    renderConsent();
    fireEvent.click(screen.getByRole("button", { name: "Permitir" }));
    expect(await screen.findByText(/Não consegui salvar sua escolha/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Permitir" })).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { LiteTour, startLiteTour } from "./lite-tour";
import { availableSteps, TOUR_STEPS, TOUR_STORAGE_KEY, totalXp } from "./tour-steps";

beforeEach(() => {
  window.localStorage.clear();
  // jsdom has no media playback: narration must fail silently.
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.reject(new Error("no audio")));
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("tour steps", () => {
  it("have unique ids, narration for every step and an intro and a finale", () => {
    const ids = TOUR_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TOUR_STEPS[0]?.kind).toBe("intro");
    expect(TOUR_STEPS.at(-1)?.kind).toBe("finale");
    for (const step of TOUR_STEPS) {
      expect(step.narration.length, step.id).toBeGreaterThan(40);
      expect(step.narration, step.id).not.toContain("—");
      expect(step.body, step.id).not.toContain("—");
    }
  });

  it("skip spotlights whose area is not on screen", () => {
    const shown = availableSteps(TOUR_STEPS, (target) => target !== "thread-cotacao");
    expect(shown.some((step) => step.target === "thread-cotacao")).toBe(false);
    expect(shown.some((step) => step.kind === "demo-reply")).toBe(true);
    expect(totalXp(shown)).toBeLessThan(totalXp(TOUR_STEPS));
  });

  it("keep the narration script in docs in sync with the code", () => {
    const doc = readFileSync(join(process.cwd(), "docs/onboarding/narracao-tour-lite.md"), "utf8");
    for (const step of TOUR_STEPS) {
      expect(doc, step.id).toContain(`${step.id}.mp3`);
      expect(doc, step.id).toContain(step.narration);
    }
  });
});

describe("LiteTour", () => {
  it("runs intro, challenge, notice and finale with XP, then remembers it was completed", async () => {
    render(<LiteTour />);
    await act(async () => { startLiteTour(); });
    expect(screen.getByRole("dialog", { name: "Seu novo jeito de atender" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Começar o tour/ }));
    // No spotlight target in jsdom: the next step is the challenge.
    expect(await screen.findByRole("dialog", { name: "Desafio rápido" })).toBeTruthy();
    const next = screen.getByRole("button", { name: /Escolha uma resposta/ }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Aceitar e chamar no WhatsApp/ }));
    expect(screen.getByRole("status").textContent).toContain("Isso!");
    expect(screen.getByText("40")).toBeTruthy(); // 10 (intro) + 30 (right answer)

    fireEvent.click(screen.getByRole("button", { name: /Próximo/ }));
    expect(await screen.findByRole("dialog", { name: "Lead novo chega assim" })).toBeTruthy();
    expect(screen.getByRole("status", { name: /Novo lead: Maria Souza/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Próximo/ }));
    expect(await screen.findByRole("dialog", { name: "Pronto para atender!" })).toBeTruthy();
    expect(screen.getByText(/Selo: Pronto para atender/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Começar a atender" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(window.localStorage.getItem(TOUR_STORAGE_KEY)).toBe("done");
  }, 20_000);

  it("can be skipped with Esc and toggles the narration", async () => {
    render(<LiteTour />);
    await act(async () => { startLiteTour(); });
    fireEvent.click(screen.getByRole("button", { name: "Silenciar narração" }));
    expect(screen.getByRole("button", { name: "Ligar narração" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(window.localStorage.getItem(TOUR_STORAGE_KEY)).toBe("skipped");
  });

  it("keeps Tab inside the tour and gives the focus back to the button that opened it", async () => {
    render(<><button type="button" onClick={() => startLiteTour()}>Abrir tour</button><LiteTour /></>);
    const trigger = screen.getByRole("button", { name: "Abrir tour" });
    trigger.focus();
    await act(async () => { fireEvent.click(trigger); });
    const dialog = screen.getByRole("dialog", { name: "Seu novo jeito de atender" });
    const buttons = Array.from(document.querySelectorAll<HTMLElement>("[data-tour-open] button:not([disabled])"));
    buttons.at(-1)!.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0]);
    buttons[0]!.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(buttons.at(-1));
    expect(dialog).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});


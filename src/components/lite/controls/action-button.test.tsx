// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fire = vi.hoisted(() => vi.fn((kind: string) => ({ kind, level: 1, sound: null, haptic: null, motion: true, celebrate: kind === "milestone" })));
const motionState = vi.hoisted(() => ({ enabled: true }));

vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => fire }));
vi.mock("@/components/motion/interface-motion-provider", () => ({ useInterfaceMotionEnabled: () => motionState.enabled }));

import { LiteActionButton } from "./action-button";

beforeEach(() => {
  fire.mockClear();
  motionState.enabled = true;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

async function click() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button"));
  });
}

describe("LiteActionButton", () => {
  it("shows the busy label, then the done label only after the action resolves", async () => {
    let resolve!: () => void;
    const onAction = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    render(<LiteActionButton busyLabel="Aceitando…" doneLabel="Lead é seu" onAction={onAction}>Aceitar</LiteActionButton>);

    await click();
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button")).toHaveTextContent("Aceitando…");
    expect(fire).toHaveBeenCalledWith("tap");

    await act(async () => { resolve(); });
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "done");
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Lead é seu");
    expect(fire).toHaveBeenLastCalledWith("confirm", { sound: false, budgetKey: undefined });
  });

  it("ignores a second click while busy", async () => {
    const onAction = vi.fn(() => new Promise<void>(() => {}));
    render(<LiteActionButton busyLabel="Enviando…" doneLabel="Enviado" onAction={onAction}>Enviar</LiteActionButton>);
    await click();
    await click();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("shows the cause and what still holds, then comes back as Tentar de novo", async () => {
    const onAction = vi.fn(async () => ({ ok: false as const, reason: "O aceite não foi registrado" }));
    render(<LiteActionButton busyLabel="Aceitando…" doneLabel="Lead é seu" keeps="O lead continua esperando você" onAction={onAction}>Aceitar</LiteActionButton>);

    await click();
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "error");
    expect(screen.getByRole("button")).toHaveTextContent("Não deu certo");
    expect(fire).toHaveBeenLastCalledWith("error");

    await act(async () => { vi.advanceTimersByTime(80); });
    expect(screen.getByRole("alert")).toHaveTextContent("O aceite não foi registrado. O lead continua esperando você.");

    await act(async () => { vi.advanceTimersByTime(1400); });
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "idle");
    expect(screen.getByRole("button")).toHaveTextContent("Tentar de novo");
    expect(screen.getByRole("button")).toHaveFocus();
  });

  it("treats a thrown error as a failure with a readable fallback", async () => {
    const onAction = vi.fn(async () => { throw new TypeError("Cannot read properties of undefined"); });
    render(<LiteActionButton busyLabel="Salvando…" doneLabel="Salvo" errorFallback="Não consegui salvar agora" onAction={onAction}>Salvar</LiteActionButton>);
    await click();
    await act(async () => { vi.advanceTimersByTime(80); });
    expect(screen.getByRole("alert")).toHaveTextContent("Não consegui salvar agora.");
  });

  it("reports whether the parent may celebrate a milestone", async () => {
    const onDone = vi.fn();
    render(<LiteActionButton busyLabel="Registrando…" doneLabel="Meta batida" feedback="milestone" budgetKey="meta-do-dia" onDone={onDone} onAction={async () => ({ ok: true })}>Registrar</LiteActionButton>);
    await click();
    expect(fire).toHaveBeenLastCalledWith("milestone", { sound: false, budgetKey: "meta-do-dia" });
    expect(onDone).toHaveBeenCalledWith(true);
  });
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

const push = vi.hoisted(() => ({ canAsk: vi.fn(async () => false), enable: vi.fn(async () => ({ ok: true as const })) }));
vi.mock("@/features/notifications/push-ask", () => ({ canAskForPush: push.canAsk }));
vi.mock("@/features/notifications/enable-push", () => ({ enablePush: push.enable }));
const tour = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock("./tour/lite-tour", () => ({ startLiteTour: tour.start }));

import { LiteWelcome } from "./lite-welcome";

beforeEach(() => { vi.useFakeTimers(); window.localStorage.clear(); push.canAsk.mockResolvedValue(false); push.enable.mockClear(); tour.start.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("LiteWelcome", () => {
  it("welcomes once, then never again on this device", () => {
    render(<LiteWelcome />);
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.getByRole("dialog", { name: "O app do corretor mudou" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    act(() => { vi.advanceTimersByTime(500); });
    cleanup();
    render(<LiteWelcome />);
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("after the welcome, asks once to turn on notifications and then starts the tour", async () => {
    push.canAsk.mockResolvedValue(true);
    render(<LiteWelcome />);
    act(() => { vi.advanceTimersByTime(400); });
    fireEvent.click(screen.getByRole("button", { name: /Fazer o tour/ }));
    await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(300); });
    expect(screen.getByRole("dialog", { name: "Não perca nenhum lead" })).toBeTruthy();
    expect(tour.start).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ativar avisos" }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(push.enable).toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Avisos ligados!" })).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(1700); });
    expect(tour.start).toHaveBeenCalled();
    cleanup();
    render(<LiteWelcome />);
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks people who already saw the welcome, and Depois never blocks", async () => {
    window.localStorage.setItem("ancora:lite-welcome:2026-10-chat", "1");
    push.canAsk.mockResolvedValue(true);
    render(<LiteWelcome />);
    await act(async () => { vi.advanceTimersByTime(400); await Promise.resolve(); });
    expect(screen.getByRole("dialog", { name: "Não perca nenhum lead" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Depois" }));
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(screen.queryByRole("dialog", { name: "Não perca nenhum lead" })).toBeNull();
    expect(push.enable).not.toHaveBeenCalled();
  });
});

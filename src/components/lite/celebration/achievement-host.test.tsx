// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feedback/use-feedback", () => ({
  fireFeedback: vi.fn(() => ({ celebrate: false })),
  fireFeedbackOnce: vi.fn(() => ({ celebrate: true })),
}));

import { AchievementHost, announceAchievement } from "./achievement-host";

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("AchievementHost", () => {
  it("sem anfitrião montado, a tela de origem dá a confirmação normal", () => {
    expect(announceAchievement({ kind: "whatsapp", key: "w0" })).toBe(false);
  });

  it("comemora a presença confirmada e a conexão do WhatsApp, uma de cada vez", async () => {
    vi.useFakeTimers();
    render(<AchievementHost />);
    act(() => {
      expect(announceAchievement({ kind: "duty", key: "d1", scheduleName: "TESTE", until: "19:00", mode: "online" })).toBe(true);
      announceAchievement({ kind: "whatsapp", key: "w1", phoneSuffix: "4321" });
    });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(screen.getByRole("dialog", { name: "Presença confirmada!" })).toBeTruthy();
    expect(screen.getByText("TESTE")).toBeTruthy();
    expect(screen.getByText("19:00")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Bora receber leads" }));
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(screen.getByRole("dialog", { name: "WhatsApp conectado!" })).toBeTruthy();
    expect(screen.getByText("final 4321")).toBeTruthy();
  });

  it("não repete a mesma conquista", async () => {
    vi.useFakeTimers();
    render(<AchievementHost />);
    act(() => { announceAchievement({ kind: "duty", key: "d2", scheduleName: "A", until: "18:00", mode: "online" }); });
    await act(async () => { vi.advanceTimersByTime(300); });
    fireEvent.click(screen.getByRole("button", { name: "Bora receber leads" }));
    act(() => { announceAchievement({ kind: "duty", key: "d2", scheduleName: "A", until: "18:00", mode: "online" }); });
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(screen.queryByRole("dialog", { name: "Presença confirmada!" })).toBeNull();
  });
});

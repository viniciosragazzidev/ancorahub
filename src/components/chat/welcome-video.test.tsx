// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});
vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));

import { LightAvailabilityProvider } from "@/components/light/light-availability-context";

import { LiteWelcome } from "./lite-welcome";

const VIDEO_KEY = "ancora:welcome-video:2026-10-v2";
const shell = (welcomeVideo: boolean) => ({ availability: "available" as const, isPending: false, setStatus: () => {}, welcomeVideo });

function renderWelcome(welcomeVideo: boolean, variant: "broker" | "supervisor" = "broker") {
  return render(<LightAvailabilityProvider value={shell(welcomeVideo)}><LiteWelcome variant={variant} /></LightAvailabilityProvider>);
}

beforeEach(() => { vi.useFakeTimers(); window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("welcome video on the first access", () => {
  it("plays before the welcome card, and skipping leads to the card once", () => {
    renderWelcome(true);
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.getByRole("dialog", { name: "Vídeo de boas-vindas do app do corretor" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "O app do corretor mudou" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    act(() => { vi.advanceTimersByTime(600); });
    // Skipped: remembered on this device, and the welcome card comes next.
    expect(window.localStorage.getItem(VIDEO_KEY)).toBe("1");
    expect(screen.getByRole("dialog", { name: "O app do corretor mudou" })).toBeTruthy();

    // Seen on this device: next time neither shows again after the card is closed.
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    act(() => { vi.advanceTimersByTime(500); });
    cleanup();
    renderWelcome(true);
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not show the video when the flag is off or to supervisors", () => {
    renderWelcome(false);
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.queryByRole("dialog", { name: "Vídeo de boas-vindas do app do corretor" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "O app do corretor mudou" })).toBeTruthy();
    cleanup();
    window.localStorage.clear();
    renderWelcome(true, "supervisor");
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.queryByRole("dialog", { name: "Vídeo de boas-vindas do app do corretor" })).toBeNull();
  });

  it("closes with Escape", () => {
    renderWelcome(true);
    act(() => { vi.advanceTimersByTime(400); });
    fireEvent.keyDown(window, { key: "Escape" });
    act(() => { vi.advanceTimersByTime(600); });
    expect(window.localStorage.getItem(VIDEO_KEY)).toBe("1");
  });
});

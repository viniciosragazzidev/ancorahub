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
import { WelcomeVideo } from "./welcome-video";

const VIDEO_KEY = "ancora:welcome-video:2026-10-v3";
const VIDEO_NAME = "Vídeo de boas-vindas do app do corretor";
const shell = (welcomeVideo: boolean) => ({ availability: "available" as const, isPending: false, setStatus: () => {}, welcomeVideo });

function renderWelcome(welcomeVideo: boolean, variant: "broker" | "supervisor" = "broker") {
  return render(<LightAvailabilityProvider value={shell(welcomeVideo)}><LiteWelcome variant={variant} /></LightAvailabilityProvider>);
}

beforeEach(() => { vi.useFakeTimers(); window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("welcome video on the first access", () => {
  it("no longer shows, even with the Super-admin flag on (19/11/2026)", () => {
    renderWelcome(true);
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.queryByRole("dialog", { name: VIDEO_NAME })).toBeNull();
    expect(window.localStorage.getItem(VIDEO_KEY)).toBeNull();
    cleanup();
    renderWelcome(true, "supervisor");
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.queryByRole("dialog", { name: VIDEO_NAME })).toBeNull();
  });

  it("the component itself still closes with Pular and Escape", () => {
    const onDone = vi.fn();
    render(<WelcomeVideo onDone={onDone} />);
    expect(screen.getByRole("dialog", { name: VIDEO_NAME })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pular" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDone).toHaveBeenCalledTimes(2);
  });
});

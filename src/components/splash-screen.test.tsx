// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SPLASH_KEY, SplashScreen } from "./splash-screen";

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  delete document.documentElement.dataset.splash;
  vi.spyOn(performance, "now").mockReturnValue(1000);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function flush(ms: number) {
  await act(async () => { vi.advanceTimersByTime(ms); });
}

describe("SplashScreen", () => {
  it("renders the captain and the ÂNCORA wordmark and stays until the animation ends", async () => {
    const { container } = render(<SplashScreen />);
    const splash = container.querySelector("[data-splash-screen]") as HTMLElement;
    expect(splash).not.toBeNull();
    expect(splash.getAttribute("aria-hidden")).toBe("true");
    expect([...container.querySelectorAll("img")].map((img) => img.getAttribute("src"))).toEqual(["/mascote/splash-capitao.webp", "/mascote/splash-ancora.webp"]);
    expect(container.querySelector("video")).toBeNull();
    expect(sessionStorage.getItem(SPLASH_KEY)).toBe("1");

    // performance.now = 1000: faltam 900 ms da animação de 1,9 s; não some antes disso.
    await flush(800);
    expect(container.querySelector("[data-splash-screen]")!.getAttribute("data-phase")).toBe("showing");
    await flush(150);
    expect(container.querySelector("[data-splash-screen]")!.getAttribute("data-phase")).toBe("leaving");
    await flush(300);
    expect(container.querySelector("[data-splash-screen]")).toBeNull();
    expect(document.documentElement.dataset.splash).toBe("done");
  });

  it("leaves right after the hydration when the animation already ended", async () => {
    vi.spyOn(performance, "now").mockReturnValue(3000);
    const { container } = render(<SplashScreen />);
    await flush(50);
    expect(container.querySelector("[data-splash-screen]")!.getAttribute("data-phase")).toBe("leaving");
  });

  it("does not show again in the same session", async () => {
    document.documentElement.dataset.splash = "done";
    const { container } = render(<SplashScreen />);
    await flush(0);
    expect(container.querySelector("[data-splash-screen]")).toBeNull();
  });
});

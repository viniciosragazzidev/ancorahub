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
    vi.spyOn(performance, "getEntriesByName").mockImplementation((name: string) => (name === "first-contentful-paint" ? [{ startTime: 100 } as PerformanceEntry] : []));
    const { container } = render(<SplashScreen />);
    const splash = container.querySelector("[data-splash-screen]") as HTMLElement;
    expect(splash).not.toBeNull();
    expect(splash.getAttribute("aria-hidden")).toBe("true");
    expect([...container.querySelectorAll("img")].map((img) => img.getAttribute("src"))).toEqual(["/mascote/splash-capitao.webp", "/mascote/splash-ancora.webp"]);
    expect(container.querySelector("video")).toBeNull();
    expect(sessionStorage.getItem(SPLASH_KEY)).toBe("1");

    // Pintou aos 100 ms e hidratou aos 1000 ms: faltam 1000 ms da animação de 1,9 s; não some antes disso.
    await flush(900);
    expect(container.querySelector("[data-splash-screen]")!.getAttribute("data-phase")).toBe("showing");
    await flush(150);
    expect(container.querySelector("[data-splash-screen]")!.getAttribute("data-phase")).toBe("leaving");
    await flush(300);
    expect(container.querySelector("[data-splash-screen]")).toBeNull();
    expect(document.documentElement.dataset.splash).toBe("done");
  });

  it("leaves right after the hydration when the animation already ended on screen", async () => {
    vi.spyOn(performance, "now").mockReturnValue(3000);
    vi.spyOn(performance, "getEntriesByName").mockImplementation((name: string) => (name === "first-contentful-paint" ? [{ startTime: 800 } as PerformanceEntry] : []));
    const { container } = render(<SplashScreen />);
    await flush(50);
    expect(container.querySelector("[data-splash-screen]")!.getAttribute("data-phase")).toBe("leaving");
  });

  it("counts from when the splash was painted, not from the navigation (slow PWA start)", async () => {
    // O servidor demorou: a splash pintou aos 3,2 s e o app hidratou aos 3,4 s. Ela ainda precisa ficar.
    vi.spyOn(performance, "now").mockReturnValue(3400);
    vi.spyOn(performance, "getEntriesByName").mockImplementation((name: string) => (name === "first-contentful-paint" ? [{ startTime: 3200 } as PerformanceEntry] : []));
    const { container } = render(<SplashScreen />);
    await flush(1500);
    expect(container.querySelector("[data-splash-screen]")!.getAttribute("data-phase")).toBe("showing");
    await flush(300);
    expect(container.querySelector("[data-splash-screen]")!.getAttribute("data-phase")).toBe("leaving");
  });

  it("counts from the mount when the browser has no paint timing", async () => {
    const { container } = render(<SplashScreen />);
    await flush(1800);
    expect(container.querySelector("[data-splash-screen]")!.getAttribute("data-phase")).toBe("showing");
  });

  it("does not show again in the same session", async () => {
    document.documentElement.dataset.splash = "done";
    const { container } = render(<SplashScreen />);
    await flush(0);
    expect(container.querySelector("[data-splash-screen]")).toBeNull();
  });
});

// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InterfaceMotionProvider } from "./interface-motion-provider";
import { useInterfaceAnimation } from "./use-interface-animation";
import { transitions } from "@/lib/motion";

const { controls } = vi.hoisted(() => ({
  controls: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn(), set: vi.fn() },
}));
vi.mock("motion/react", () => ({
  useAnimation: () => controls,
  MotionConfig: ({ children }: { children: ReactNode }) => children,
}));

describe("shared animated icon controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.interfaceMotion;
  });

  it("uses shared timing and stops an active icon when globally disabled", async () => {
    let enabled = true;
    const { result, rerender } = renderHook(useInterfaceAnimation, {
      wrapper: ({ children }) => (
        <InterfaceMotionProvider enabled={enabled}>{children}</InterfaceMotionProvider>
      ),
    });
    await act(() => result.current.start("animate"));
    expect(controls.start).toHaveBeenCalledWith("animate", transitions.normal);
    enabled = false;
    rerender();
    expect(controls.stop).toHaveBeenCalled();
    expect(controls.set).toHaveBeenCalledWith("normal");
    controls.start.mockClear();
    await act(() => result.current.start("animate"));
    expect(controls.start).not.toHaveBeenCalled();
  });
});

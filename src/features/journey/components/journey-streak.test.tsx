// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motion = vi.hoisted(() => ({ enabled: true }));
vi.mock("@/components/motion/interface-motion-provider", () => ({ useInterfaceMotionEnabled: () => motion.enabled }));

import { useStreakRose } from "./journey-screen";

afterEach(() => cleanup());
beforeEach(() => {
  window.localStorage.clear();
  motion.enabled = true;
});

describe("sequência de plantão na jornada", () => {
  it("na primeira visita só guarda o valor, sem subir", () => {
    const { result } = renderHook(() => useStreakRose(3));
    expect(result.current).toBe(false);
    expect(window.localStorage.getItem("ancora:journey-streak-seen")).toBe("3");
  });

  it("sobe uma vez quando a sequência aumentou e não repete na visita seguinte", () => {
    window.localStorage.setItem("ancora:journey-streak-seen", "3");
    expect(renderHook(() => useStreakRose(4)).result.current).toBe(true);
    cleanup();
    expect(renderHook(() => useStreakRose(4)).result.current).toBe(false);
  });

  it("não sobe quando a sequência caiu ou com movimento desligado (e não gasta a vez)", () => {
    window.localStorage.setItem("ancora:journey-streak-seen", "5");
    expect(renderHook(() => useStreakRose(0)).result.current).toBe(false);
    cleanup();
    motion.enabled = false;
    expect(renderHook(() => useStreakRose(1)).result.current).toBe(false);
    expect(window.localStorage.getItem("ancora:journey-streak-seen")).toBe("0");
  });
});

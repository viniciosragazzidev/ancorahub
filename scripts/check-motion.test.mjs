import { describe, expect, it } from "vitest";

import { compareWithBaseline, scanMotionSource } from "./check-motion.mjs";

describe("trava de movimento (catraca)", () => {
  it("conta os padrões proibidos num arquivo de tela", () => {
    const counts = scanMotionSource("src/app/(dashboard)/x/page.tsx", `
      <span className="animate-bounce transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:shadow-none" />
      navigator.vibrate(20); playSound("tap");
    `);
    expect(counts).toEqual({ bounce: 1, transitionAll: 1, hoverLift: 2, rawDuration: 1, rawFeedback: 2 });
  });

  it("som e vibração dentro de src/lib/feedback não contam", () => {
    expect(scanMotionSource("src/lib/feedback/core.ts", "navigator.vibrate(30)").rawFeedback).toBe(0);
  });

  it("só falha quando um número sobe acima da linha de base", () => {
    expect(compareWithBaseline({ bounce: 0, transitionAll: 40 }, { bounce: 0, transitionAll: 49 })).toEqual([]);
    expect(compareWithBaseline({ bounce: 1, transitionAll: 49 }, { bounce: 0, transitionAll: 49 })).toEqual([{ rule: "bounce", count: 1, baseline: 0 }]);
  });
});

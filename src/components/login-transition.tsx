"use client";

import { useState, useEffect } from "react";
import { AnimatedLogo } from "@/components/branding/animated-logo";

type Phase = "idle" | "logo_animating" | "page_cover";

interface LoginTransitionProps {
  active: boolean;
  onComplete: () => void;
}

export function LoginTransition({ active, onComplete }: LoginTransitionProps) {
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (!active) {
      setPhase("idle");
      return;
    }

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      onComplete();
      return;
    }

    setPhase("logo_animating");

    // After 1.8s (draw 1.4s + fill 0.25s + finish 0.15s), cover the screen and complete transition
    const t = setTimeout(() => {
      setPhase("page_cover");
      onComplete();
    }, 1800);

    return () => {
      clearTimeout(t);
    };
  }, [active, onComplete]);

  if (phase === "idle") return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background pointer-events-auto select-none"
    >
      {/* Full screen solid background overlay */}
      <div className="absolute inset-0 bg-background" />

      {/* Animated SVG Logo */}
      <div className="relative z-10 flex items-center justify-center">
        <AnimatedLogo isWaiting={phase === "logo_animating"} />
      </div>
    </div>
  );
}


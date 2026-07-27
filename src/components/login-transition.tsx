"use client";

import { useState, useEffect } from "react";
import { CorreTopLogo } from "@/components/corretop-logo";

type Phase = "idle" | "logo_in" | "logo_pulse" | "page_cover";

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

    setPhase("logo_in");

    const t1 = setTimeout(() => setPhase("logo_pulse"), 500);
    const t2 = setTimeout(() => {
      setPhase("page_cover");
      // Trigger navigation while the full-screen overlay remains active
      onComplete();
    }, 1200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active, onComplete]);

  if (phase === "idle") return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background pointer-events-auto select-none"
    >
      {/* Full screen solid background overlay so login form is never visible underneath */}
      <div className="absolute inset-0 bg-background" />

      {/* Logo */}
      <div
        className="relative z-10 flex items-center justify-center"
        style={{
          opacity: phase === "logo_in" || phase === "logo_pulse" || phase === "page_cover" ? 1 : 0,
          transform:
            phase === "logo_in"
              ? "scale(0.9) translateY(8px)"
              : phase === "logo_pulse"
                ? "scale(1) translateY(0)"
                : "scale(1.02) translateY(0)",
          transition: "opacity 0.5s cubic-bezier(0.22,1,0.36,1), transform 0.5s cubic-bezier(0.22,1,0.36,1)",
          willChange: "opacity, transform",
        }}
      >
        <CorreTopLogo className="h-14 w-52 object-contain" />
      </div>

      {/* Pulsing ring behind logo */}
      <div
        className="absolute z-0 rounded-full border-2 border-primary/30"
        style={{
          width: 120,
          height: 120,
          opacity: phase === "logo_pulse" || phase === "page_cover" ? 1 : 0,
          transform: phase === "logo_pulse" || phase === "page_cover" ? "scale(1.6)" : "scale(0.8)",
          transition: "opacity 0.4s ease, transform 1s cubic-bezier(0.22,1,0.36,1)",
          animation: "loginPulseRing 1.2s ease-in-out infinite",
          willChange: "opacity, transform",
        }}
      />

      <style>{`
        @keyframes loginPulseRing {
          0%, 100% {
            transform: scale(1.4);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.8);
            opacity: 0.15;
          }
        }
      `}</style>
    </div>
  );
}

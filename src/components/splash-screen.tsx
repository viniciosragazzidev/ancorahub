"use client";

import { useState, useEffect } from "react";
import { CorreTopLogo } from "@/components/corretop-logo";

const SPLASH_KEY = "__corretop_splash_shown";

/**
 * PWA splash screen.
 *
 * - Starts unmounted so a full page navigation never flashes the overlay.
 * - Shows only once per browser session (tracked via sessionStorage).
 * - On first mount the logo fades in (700 ms), holds briefly (300 ms),
 *   then the entire overlay fades out (500 ms) and unmounts.
 * - Respects reduced‑motion: skips all animations and hides instantly.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<SplashPhase>("hidden");

  useEffect(() => {
    // Already shown this session — skip entirely
    if (sessionStorage.getItem(SPLASH_KEY)) {
      return;
    }

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      sessionStorage.setItem(SPLASH_KEY, "1");
      return;
    }

    sessionStorage.setItem(SPLASH_KEY, "1");
    let logoIn = 0;
    const show = requestAnimationFrame(() => {
      setPhase("idle");
      logoIn = requestAnimationFrame(() => setPhase("logo_enter"));
    });
    const splashOut = setTimeout(() => setPhase("splash_exit"), 700 + 300);
    const remove = setTimeout(() => setPhase("hidden"), 700 + 300 + 500);

    return () => {
      cancelAnimationFrame(show);
      cancelAnimationFrame(logoIn);
      clearTimeout(splashOut);
      clearTimeout(remove);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--surface-base,#f8f8f7)] transition-opacity duration-500 ease-[var(--ease-smooth-out,cubic-bezier(0.22,1,0.36,1))]"
      style={{
        opacity: phase === "splash_exit" ? 0 : 1,
        willChange: "opacity",
      }}
    >
      <CorreTopLogo
        className="h-12 w-48 object-contain"
        style={{
          opacity: phase === "idle" ? 0 : 1,
          transform: phase === "idle" ? "scale(0.92) translateY(4px)" : "scale(1) translateY(0)",
          transition: "opacity 700ms var(--ease-smooth-out), transform 700ms var(--ease-smooth-out)",
          willChange: "opacity, transform",
        }}
      />
    </div>
  );
}

type SplashPhase = "idle" | "logo_enter" | "splash_exit" | "hidden";

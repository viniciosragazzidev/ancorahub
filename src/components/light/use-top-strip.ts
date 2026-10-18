"use client";

import { useLayoutEffect, type RefObject } from "react";

/**
 * A strip fixed above the app (view-as, WhatsApp not connected). The body never scrolls
 * (globals.css): the screens that fill the viewport (--app-dvh) give up the strip's height,
 * or their end is cut off. Only one strip shows at a time.
 */
export function useTopStrip(ref: RefObject<HTMLElement | null>, active: boolean) {
  // Layout effect: runs before the tours and welcome cards (rendered after the strip) measure the screen.
  useLayoutEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const strip = ref.current;
    const fit = () => html.style.setProperty("--app-dvh", `calc(100dvh - ${strip?.offsetHeight ?? 0}px)`);
    fit();
    const observer = strip && typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    if (strip) observer?.observe(strip);
    return () => {
      observer?.disconnect();
      html.style.removeProperty("--app-dvh");
    };
  }, [ref, active]);
}

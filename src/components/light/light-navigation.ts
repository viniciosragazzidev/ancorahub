"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * In-app navigations since the page was loaded (decremented on back/forward).
 * document.referrer only describes the first load, so "can I go back inside
 * the app?" is tracked here instead.
 */
let inAppDepth = 0;

export function canGoBackInApp() {
  return inAppDepth > 0;
}

/** Mount once in the Light chrome. */
export function useLightNavigationTracker() {
  const pathname = usePathname();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current !== pathname) {
      previous.current = pathname;
      inAppDepth += 1;
    }
  }, [pathname]);

  useEffect(() => {
    const onPopState = () => {
      inAppDepth = Math.max(0, inAppDepth - 1);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
}

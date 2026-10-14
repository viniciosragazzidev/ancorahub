"use client";

import { useLayoutEffect } from "react";

/**
 * Dev-only: the Lite chrome titles the screen from the pathname, and the preview lives under /dev.
 * Setting the address to the real route before the chrome reads it gives the same header the gestor sees.
 */
export function RouteAs({ path }: { path: string }) {
  useLayoutEffect(() => {
    // After hydration: Next patches history.replaceState only once the app router is running.
    const timer = window.setTimeout(() => {
      if (window.location.pathname !== path) window.history.replaceState(window.history.state, "", path);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [path]);
  return null;
}

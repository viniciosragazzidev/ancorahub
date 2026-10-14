"use client";

import { useLayoutEffect } from "react";

/**
 * Dev-only: the Lite chrome titles the screen from the pathname, and the preview lives under /dev.
 * Setting the address to the real route (/clientes, /clientes/<id>) before the chrome reads it gives the
 * same header the gestor sees. Next keeps usePathname in sync with replaceState.
 */
export function RouteAs({ path }: { path: string }) {
  useLayoutEffect(() => {
    if (window.location.pathname !== path) window.history.replaceState(window.history.state, "", path);
  }, [path]);
  return null;
}

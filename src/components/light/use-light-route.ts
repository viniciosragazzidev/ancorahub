"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { resolveLightRoute } from "./light-routes";

/** Title, active tab and parent route of the current Light screen. */
export function useLightRoute() {
  const pathname = usePathname();
  return useMemo(() => ({ pathname, ...resolveLightRoute(pathname) }), [pathname]);
}

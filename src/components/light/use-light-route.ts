"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { resolveLightRoute } from "./light-routes";

/** Title, active tab and parent route of the current Light screen (a few screens depend on the query). */
export function useLightRoute() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return useMemo(() => ({ pathname, ...resolveLightRoute(pathname, searchParams) }), [pathname, searchParams]);
}

"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { resolveDirectorRoute } from "./director-routes";

export function useDirectorRoute() {
  const pathname = usePathname();
  return useMemo(() => ({ pathname, ...resolveDirectorRoute(pathname) }), [pathname]);
}

"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { resolveLightRoute, type LightRouteOptions } from "./light-routes";

/** Title, active tab and parent route of the current Light screen (a few screens depend on the query). */
export function useLightRoute(options: LightRouteOptions = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const brokerMyWallet = options.brokerMyWallet === true;
  return useMemo(() => ({ pathname, ...resolveLightRoute(pathname, searchParams, { brokerMyWallet }) }), [pathname, searchParams, brokerMyWallet]);
}

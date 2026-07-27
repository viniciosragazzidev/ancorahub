"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { getRouteOnboardingStateAction } from "../actions/route-onboarding-actions";
import { getRouteOnboardingDefinition } from "../route-onboarding";
import { RouteOnboardingDialog } from "./route-onboarding-dialog";

export function RouteOnboardingLoader() {
  const pathname = usePathname();
  const definition = getRouteOnboardingDefinition(pathname);
  const [initialOpen, setInitialOpen] = useState(false);
  const requestedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!definition || requestedKey.current === definition.key) return;
    requestedKey.current = definition.key;
    setInitialOpen(false);
    let cancelled = false;
    void getRouteOnboardingStateAction(definition.key).then((state) => {
      if (!cancelled) setInitialOpen(state.shouldShow);
    }).catch(() => {
      if (!cancelled) setInitialOpen(false);
    });
    return () => { cancelled = true; };
  }, [definition]);

  if (!definition || !initialOpen) return null;
  return <RouteOnboardingDialog definition={definition} initialOpen />;
}

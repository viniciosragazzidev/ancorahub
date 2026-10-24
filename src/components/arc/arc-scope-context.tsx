"use client";

import { createContext, useContext, type ReactNode } from "react";

export const DIRECTOR_LITE_PORTAL_ROOT_ID = "director-lite-portal-root";

const ArcScopeContext = createContext(false);

export function ArcScopeProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <ArcScopeContext.Provider value={enabled}>{children}</ArcScopeContext.Provider>;
}

export function useArcScopeEnabled() {
  return useContext(ArcScopeContext);
}

export function getArcScopeProps(enabled: boolean) {
  return enabled ? { className: "arc-venancor", "data-skin": "diretor" as const } : {};
}

export function useArcScopeProps() {
  return getArcScopeProps(useArcScopeEnabled());
}

export function useArcPortalTarget(): HTMLElement | null {
  const enabled = useArcScopeEnabled();
  if (typeof document === "undefined") return null;
  if (!enabled) return document.body;
  return document.getElementById(DIRECTOR_LITE_PORTAL_ROOT_ID) ?? document.body;
}

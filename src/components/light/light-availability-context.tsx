"use client";

import { createContext, useContext } from "react";

import type { LightAvailability } from "@/components/light-top-nav";

export type LightAvailabilityValue = {
  availability: LightAvailability;
  isPending: boolean;
  setStatus: (next: "available" | "paused") => void;
  /** Opens the "Mais" sheet (chat screens have no tab bar of their own). */
  openMore?: () => void;
  /** Who uses the Lite: the broker (default) or the supervisor (team, no availability). */
  audience?: "broker" | "supervisor";
  /** The welcome video plays first on the broker's first access (Super-admin flag). */
  welcomeVideo?: boolean;
};

const LightAvailabilityContext = createContext<LightAvailabilityValue | null>(null);

export const LightAvailabilityProvider = LightAvailabilityContext.Provider;

/** Availability state of the Light chrome, shared with screens (null outside the Light shell). */
export function useLightAvailabilityContext() {
  return useContext(LightAvailabilityContext);
}

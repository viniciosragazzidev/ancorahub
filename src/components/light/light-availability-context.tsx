"use client";

import { createContext, useContext } from "react";

import type { LightAvailability } from "@/components/light-top-nav";

export type LightAvailabilityValue = {
  availability: LightAvailability;
  isPending: boolean;
  setStatus: (next: "available" | "paused") => void;
};

const LightAvailabilityContext = createContext<LightAvailabilityValue | null>(null);

export const LightAvailabilityProvider = LightAvailabilityContext.Provider;

/** Availability state of the Light chrome, shared with screens (null outside the Light shell). */
export function useLightAvailabilityContext() {
  return useContext(LightAvailabilityContext);
}

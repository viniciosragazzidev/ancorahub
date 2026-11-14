"use client";

import { createContext, useContext } from "react";

import type { LightAvailability, LightAvailabilityOptions } from "@/components/light-top-nav";

export type LightAvailabilityValue = {
  availability: LightAvailability;
  isPending: boolean;
  setStatus: (next: "available" | "paused", options?: LightAvailabilityOptions) => void;
  /** Causa da última falha ao mudar a disponibilidade (já normalizada), para a tela mostrar no lugar. */
  error?: string | null;
  /** Opens the "Mais" sheet (chat screens have no tab bar of their own). */
  openMore?: (opener?: HTMLElement) => void;
  /** Who uses the Lite: the broker (default) or the supervisor (team, no availability). */
  audience?: "broker" | "supervisor" | "manager";
  /** The welcome video plays first on the broker's first access (Super-admin flag). */
  welcomeVideo?: boolean;
  homeRedesign?: boolean;
  showHomeLearning?: boolean;
  homeTools?: { href: string; label: string }[];
};

const LightAvailabilityContext = createContext<LightAvailabilityValue | null>(null);

export const LightAvailabilityProvider = LightAvailabilityContext.Provider;

/** Availability state of the Light chrome, shared with screens (null outside the Light shell). */
export function useLightAvailabilityContext() {
  return useContext(LightAvailabilityContext);
}

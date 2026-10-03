"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { MotionConfig } from "motion/react";
import { useReducedMotionPreference } from "@/utils/animation/use-reduced-motion";
import { transitions } from "@/lib/motion";

const InterfaceMotionContext = createContext(true);

export function InterfaceMotionProvider({
  children,
  enabled,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const [configuredEnabled, setConfiguredEnabled] = useState(false);
  const reducedMotion = useReducedMotionPreference();
  const motionEnabled = (enabled ?? configuredEnabled) && !reducedMotion;

  useEffect(() => {
    if (enabled !== undefined) return;
    let disposed = false;
    let request: AbortController | null = null;
    async function refresh() {
      if (document.visibilityState === "hidden" || request) return;
      const controller = new AbortController();
      request = controller;
      const timeout = window.setTimeout(() => controller.abort(), 5_000);
      try {
        const response = await fetch("/api/public/interface-motion", {
          cache: "no-store",
          credentials: "omit",
          signal: controller.signal,
        });
        const data: unknown = response.ok ? await response.json() : null;
        if (!disposed)
          setConfiguredEnabled(
            typeof data === "object" && data !== null && "enabled" in data && data.enabled === true,
          );
      } catch {
        if (!disposed) setConfiguredEnabled(false);
      } finally {
        window.clearTimeout(timeout);
        request = null;
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      disposed = true;
      request?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [enabled]);

  useEffect(() => {
    document.documentElement.dataset.interfaceMotion = motionEnabled ? "on" : "off";
  }, [motionEnabled]);

  return (
    <InterfaceMotionContext.Provider value={motionEnabled}>
      <MotionConfig
        reducedMotion={motionEnabled ? "user" : "always"}
        transition={motionEnabled ? transitions.normal : { duration: 0 }}
      >
        {children}
      </MotionConfig>
    </InterfaceMotionContext.Provider>
  );
}

export function useInterfaceMotionEnabled() {
  const enabled = useContext(InterfaceMotionContext);
  const reducedMotion = useReducedMotionPreference();
  return enabled && !reducedMotion;
}

/** Compatibility adapter for components that already model a reduced state. */
export function useInterfaceReducedMotion() {
  return !useInterfaceMotionEnabled();
}

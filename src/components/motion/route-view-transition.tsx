"use client";

import { ViewTransition } from "react";

import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import { useReducedMotionPreference } from "@/shared/hooks/use-reduced-motion";

export function RouteViewTransition({ children }: { children: React.ReactNode }) {
  const motionEnabled = useInterfaceMotionEnabled();
  const prefersReducedMotion = useReducedMotionPreference();

  if (!motionEnabled || prefersReducedMotion) return children;

  return (
    <ViewTransition enter="ct-route-enter" exit="ct-route-exit" default="none">
      {children}
    </ViewTransition>
  );
}

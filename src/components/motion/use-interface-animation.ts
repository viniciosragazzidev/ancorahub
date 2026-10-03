"use client";

import { useEffect, useMemo } from "react";
import { useAnimation } from "motion/react";
import { transitions } from "@/lib/motion";
import { useInterfaceMotionEnabled } from "./interface-motion-provider";

/** Animated icons expose the same imperative API, including in static mode. */
export function useInterfaceAnimation(): ReturnType<typeof useAnimation> {
  const controls = useAnimation();
  const enabled = useInterfaceMotionEnabled();

  useEffect(() => {
    if (!enabled) {
      controls.stop();
      controls.set("normal");
    }
  }, [controls, enabled]);

  return useMemo<ReturnType<typeof useAnimation>>(
    () => ({
      ...controls,
      start: (definition, override) => {
        if (!enabled) {
          controls.set("normal");
          return Promise.resolve();
        }
        return controls.start(definition, { ...transitions.normal, ...override });
      },
    }),
    [controls, enabled],
  );
}

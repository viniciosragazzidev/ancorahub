"use client";

import { createContext, useContext } from "react";
import { MotionConfig } from "motion/react";

const InterfaceMotionContext = createContext(true);

export function InterfaceMotionProvider({
  children,
  enabled,
}: {
  children: React.ReactNode;
  enabled: boolean;
}) {
  return (
    <InterfaceMotionContext.Provider value={enabled}>
      <MotionConfig reducedMotion={enabled ? "user" : "always"}>{children}</MotionConfig>
    </InterfaceMotionContext.Provider>
  );
}

export function useInterfaceMotionEnabled() {
  return useContext(InterfaceMotionContext);
}

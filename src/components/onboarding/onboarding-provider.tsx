"use client";

import type { ReactNode } from "react";
import { NextStep, NextStepProvider } from "nextstepjs";
import { OnboardingCard } from "./onboarding-card";

type OnboardingProviderProps = {
  children: ReactNode;
};

// Tutoriais temporariamente desativados conforme solicitação do usuário.
export function OnboardingProvider({ children }: OnboardingProviderProps) {
  return (
    <NextStepProvider>
      <NextStep
        steps={[]}
        cardComponent={OnboardingCard}
      >
        {children}
      </NextStep>
    </NextStepProvider>
  );
}

"use client";

import type { ReactNode } from "react";
import { NextStep, NextStepProvider } from "nextstepjs";
import { allOnboardingTours } from "@/features/onboarding/tours";
import { OnboardingCard } from "./onboarding-card";
import { updateUserTourProgressAction } from "@/features/onboarding/actions/onboarding-progress-actions";

type OnboardingProviderProps = {
  children: ReactNode;
};

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  return (
    <NextStepProvider>
      <NextStep
        steps={allOnboardingTours}
        cardComponent={OnboardingCard}
        overlayZIndex={9999}
        clickThroughOverlay={false}
        onStart={(tourName) => {
          if (tourName) {
            void updateUserTourProgressAction({
              tourKey: tourName,
              status: "in_progress",
              currentStep: 0,
            });
          }
        }}
        onStepChange={(step, tourName) => {
          if (tourName) {
            void updateUserTourProgressAction({
              tourKey: tourName,
              status: "in_progress",
              currentStep: step,
            });
          }
        }}
        onComplete={(tourName) => {
          if (tourName) {
            void updateUserTourProgressAction({
              tourKey: tourName,
              status: "completed",
            });
          }
        }}
        onSkip={(step, tourName) => {
          if (tourName) {
            void updateUserTourProgressAction({
              tourKey: tourName,
              status: "skipped",
              currentStep: step,
            });
          }
        }}
      >
        {children}
      </NextStep>
    </NextStepProvider>
  );
}

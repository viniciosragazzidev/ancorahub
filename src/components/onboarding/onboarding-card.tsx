"use client";

import { useEffect } from "react";
import type { CardComponentProps } from "nextstepjs";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function OnboardingCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow,
}: CardComponentProps) {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  useEffect(() => {
    if (step.selector) {
      const el = document.querySelector(step.selector);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        const timer = setTimeout(() => {
          window.dispatchEvent(new Event("resize"));
        }, 120);
        return () => clearTimeout(timer);
      }
    }
  }, [step.selector, currentStep]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.98 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-[min(380px,calc(100vw-24px))]"
      >
        <Card
          role="dialog"
          aria-label={step.title}
          className="relative flex max-h-[min(520px,85vh)] flex-col overflow-hidden border-border/80 bg-card p-5 shadow-2xl"
        >
          {arrow}
          <div className="mb-3 flex shrink-0 items-start gap-3">
            {step.icon ? (
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base"
                aria-hidden="true"
              >
                {step.icon}
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                Etapa {currentStep + 1} de {totalSteps}
              </p>
              <h2 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
                {step.title}
              </h2>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 text-xs leading-relaxed text-muted-foreground">
            {step.content}
          </div>

          <div className="mt-4 shrink-0 space-y-3 border-t border-border/40 pt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={false}
                animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={skipTour}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                Pular
              </Button>
              <div className="flex items-center gap-2">
                {!isFirstStep && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={prevStep}
                    className="h-8 text-xs"
                  >
                    Voltar
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={nextStep}
                  className="h-8 px-4 text-xs font-medium"
                >
                  {isLastStep ? "Concluir" : "Próximo"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

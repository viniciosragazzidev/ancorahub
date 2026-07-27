"use client";

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";

import {
  ArrowRight,
  Buildings,
  CalendarBlank,
  ChartBar,
  CurrencyCircleDollar,
  FileText,
  Gear,
  House,
  ListChecks,
  LockKey,
  RocketLaunch,
  ShieldCheck,
  SquaresFour,
  Target,
  Users,
  X,
} from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogDescription, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { RouteOnboardingDefinition, RouteOnboardingIcon } from "../route-onboarding";
import { completeRouteOnboardingAction } from "../actions/route-onboarding-actions";

const iconMap: Record<RouteOnboardingIcon, typeof House> = {
  dashboard: SquaresFour,
  leads: FileText,
  distribution: Users,
  conversations: FileText,
  clients: Users,
  documents: FileText,
  tasks: ListChecks,
  calendar: CalendarBlank,
  sales: ChartBar,
  finance: CurrencyCircleDollar,
  team: Users,
  branches: Buildings,
  reports: ChartBar,
  goals: Target,
  settings: Gear,
  integrity: ShieldCheck,
  guide: RocketLaunch,
};

type RouteOnboardingDialogProps = { definition: RouteOnboardingDefinition; initialOpen: boolean };

export function RouteOnboardingDialog({ definition, initialOpen }: RouteOnboardingDialogProps) {
  const [open, setOpen] = useState(initialOpen);
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [isPending, startTransition] = useTransition();
  const Icon = iconMap[definition.icon];

  useEffect(() => {
    setOpen(initialOpen);
    if (initialOpen) {
      setStep(1);
    }
  }, [initialOpen]);

  function finish() {
    startTransition(async () => {
      await completeRouteOnboardingAction(definition.key);
      setOpen(false);
    });
  }

  const handleNext = () => {
    if (step < 3) {
      setDirection(1);
      setStep((prev) => prev + 1);
    } else {
      finish();
    }
  };

  // Prevent closing on escape or clicking outside unless finished
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !isPending) {
      finish();
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 60 : -60,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: "spring" as const, stiffness: 350, damping: 30 },
        opacity: { duration: 0.2 },
      },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -60 : 60,
      opacity: 0,
      transition: {
        x: { type: "spring" as const, stiffness: 350, damping: 30 },
        opacity: { duration: 0.2 },
      },
    }),
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup
        className="border-0 bg-transparent p-0 shadow-none max-w-[380px] w-full select-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
        overlayClassName="bg-slate-950/60 backdrop-blur-md dark:bg-black/80"
      >
        <div className="relative flex min-h-[280px] max-h-[calc(100dvh-2rem)] w-full flex-col justify-between overflow-hidden rounded-xl border border-white/40 bg-background p-6 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.12)] focus:outline-none focus-visible:outline-none dark:border-white/10 dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] sm:p-7">

          {/* Close button */}
          <DialogClose render={
            <Button
              aria-label="Fechar apresentação"
              className="absolute right-5 top-5 z-10 flex size-8 items-center justify-center rounded-full bg-white/70 dark:bg-slate-800/80 text-muted-foreground/75 border border-white/40 dark:border-white/10 hover:bg-white dark:hover:bg-slate-850 hover:text-foreground transition-colors focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
              size="icon"
              variant="ghost"
            >
              <X className="size-4" />
            </Button>
          } />

          {/* Slide Content */}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar overscroll-contain py-1">
            <AnimatePresence custom={direction} mode="wait">
              {step === 1 && (
                <motion.div
                  key="step-1"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="flex flex-col items-start gap-5"
                >
                  <div className="flex size-14 items-center justify-center rounded-[1.25rem] bg-white dark:bg-slate-800 shadow-[0_8px_16px_rgba(0,0,0,0.04)] border border-black/[0.03] dark:border-white/5">
                    <Icon className="size-7 text-foreground" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#3b82f6]">
                      {definition.eyebrow}
                    </span>
                    <DialogTitle className="mt-2 text-xl font-bold tracking-tight text-foreground leading-tight">
                      {definition.title}
                    </DialogTitle>
                    <DialogDescription className="mt-3 text-base leading-relaxed text-muted-foreground/80 font-normal">
                      {definition.description}
                    </DialogDescription>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step-2"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="flex flex-col items-start gap-5"
                >
                  <div className="flex gap-3">
                    <div className="flex size-14 items-center justify-center rounded-[1.25rem] bg-white dark:bg-slate-800 shadow-[0_8px_16px_rgba(0,0,0,0.04)] border border-black/[0.03] dark:border-white/5">
                      <Target className="size-7 text-foreground" />
                    </div>
                    <div className="flex size-14 items-center justify-center rounded-[1.25rem] bg-white dark:bg-slate-800 shadow-[0_8px_16px_rgba(0,0,0,0.04)] border border-black/[0.03] dark:border-white/5">
                      <LockKey className="size-7 text-foreground" />
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#3b82f6]">
                      Recursos e Acesso
                    </span>
                    <DialogTitle className="mt-2 text-xl font-bold tracking-tight text-foreground leading-tight">
                      O que você encontrará
                    </DialogTitle>
                    <DialogDescription className="mt-3 text-base leading-relaxed text-muted-foreground/80 font-normal">
                      Esta tela permite que você acompanhe o contexto da operação, encontre o próximo passo a seguir e visualize as permissões de segurança de forma rápida.
                    </DialogDescription>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step-3"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="flex flex-col items-start gap-5"
                >
                  <div className="flex size-14 items-center justify-center rounded-[1.25rem] bg-white dark:bg-slate-800 shadow-[0_8px_16px_rgba(0,0,0,0.04)] border border-black/[0.03] dark:border-white/5">
                    <RocketLaunch className="size-7 text-foreground" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#3b82f6]">
                      Dica Operacional
                    </span>
                    <DialogTitle className="mt-2 text-xl font-bold tracking-tight text-foreground leading-tight">
                      Dica para começar
                    </DialogTitle>
                    <DialogDescription className="mt-3 text-base leading-relaxed text-muted-foreground/80 font-normal">
                      {definition.tip}
                    </DialogDescription>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom Bar: Indicators & Button */}
          <div className="flex items-center justify-between border-t border-black/[0.04] dark:border-white/5 pt-5 mt-4">

            {/* Dots */}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((s) => (
                <span
                  key={s}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    step === s ? "w-5 bg-[#3b82f6]" : "w-1.5 bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>

            <Button
              disabled={isPending}
              onClick={handleNext}
              type="button"
              className="rounded-full px-5 py-5 bg-[#3b82f6] text-white hover:bg-[#2563eb] text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all duration-200 shrink-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            >
              {step === 3 ? (isPending ? "Salvando..." : "Começar") : "Continuar"}
              <ArrowRight className="size-3.5" />
            </Button>

          </div>

        </div>
      </DialogPopup>
    </Dialog>
  );
}

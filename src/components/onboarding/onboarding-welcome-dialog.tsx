"use client";

import { useEffect, useState } from "react";
import { useNextStep } from "nextstepjs";
import { motion } from "motion/react";
import { Sparkle, ArrowRight, X } from "@phosphor-icons/react";

import { AncoraLogo } from "@/components/ancora-logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { getUserDisplayInfo } from "@/shared/auth/actions";
import { getUserTourProgressAction } from "@/features/onboarding/actions/onboarding-progress-actions";

export function OnboardingWelcomeDialog() {
  const [open, setOpen] = useState(false);
  const [userName, setUserName] = useState("Corretor");
  const [roleTourKey, setRoleTourKey] = useState("broker-welcome");
  const { startNextStep } = useNextStep();

  useEffect(() => {
    async function initWelcome() {
      try {
        const info = await getUserDisplayInfo();
        if (info?.name) {
          setUserName(info.name.split(" ")[0]);
        }

        const role = info?.roleKey || info?.role;
        let targetTour = "broker-welcome";
        if (info?.isPlatformAdmin || role === "director" || role === "Diretor") {
          targetTour = "director-welcome";
        } else if (role === "manager" || role === "Gestor" || role === "supervisor" || role === "Supervisor") {
          targetTour = "manager-welcome";
        }
        setRoleTourKey(targetTour);

        const progress = await getUserTourProgressAction(targetTour);
        if (!progress || progress.status === "not_started") {
          setOpen(true);
        }
      } catch (err) {
        console.error("Failed to check onboarding welcome status:", err);
      }
    }

    void initWelcome();
  }, []);

  const handleStartTour = () => {
    setOpen(false);
    setTimeout(() => {
      startNextStep(roleTourKey);
    }, 300);
  };

  const handleExploreAlone = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPopup className="max-w-md overflow-hidden border-border/80 bg-card p-0 shadow-2xl">
        <DialogTitle className="sr-only">Boas-vindas ao Âncora CRM</DialogTitle>
        <div className="relative p-6 text-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 size-8 rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center"
          >
            <div className="mb-4 flex h-12 w-32 items-center justify-center">
              <AncoraLogo className="h-8 w-full object-contain" />
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkle className="size-3.5" />
              Recepção do Usuário
            </span>

            <h2 className="mt-3 text-xl font-bold tracking-tight text-foreground">
              Bem-vindo ao Âncora CRM, {userName}.
            </h2>

            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Aqui você acompanha seus leads, atendimentos, tarefas e documentos em um único lugar.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="mt-6 flex flex-col gap-2.5"
          >
            <Button
              onClick={handleStartTour}
              className="group h-10 w-full justify-center gap-2 text-xs font-semibold"
            >
              Conhecer o sistema
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Button>

            <Button
              variant="outline"
              onClick={handleExploreAlone}
              className="h-9 w-full text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Explorar sozinho
            </Button>

            <span className="mt-1 text-[11px] text-muted-foreground/80">
              ⏱️ Leva aproximadamente 2 minutos
            </span>
          </motion.div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}

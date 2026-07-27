"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { FileArrowDown, ArrowSquareOut, X } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "corretop-pwa-install-dismissed-at";
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 14;

function useIsIOS(): boolean {
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as Record<string, boolean>).MSStream;
    const frame = window.requestAnimationFrame(() => setIsIOS(ios));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return isIOS;
}

function useIsStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      setIsStandalone(standalone);
    };
    check();
    const mql = window.matchMedia("(display-mode: standalone)");
    mql.addEventListener("change", check);
    return () => mql.removeEventListener("change", check);
  }, []);
  return isStandalone;
}

export function PwaInstallPrompt() {
  const deferredPrompt = useRef<InstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const isIOS = useIsIOS();
  const isStandalone = useIsStandalone();

  const shouldSkipPrompt = useCallback(() => {
    if (typeof window === "undefined") return true;
    if (isStandalone) return true;
    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_KEY) ?? 0);
    return dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
  }, [isStandalone]);

  const rememberDismissal = useCallback(() => {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setShowCard(false);
  }, []);

  const installApp = useCallback(async () => {
    const promptEvent = deferredPrompt.current;
    if (!promptEvent) return;
    deferredPrompt.current = null;
    setShowCard(false);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      toast.success("CorreTop instalado", {
        description: "Você já pode abrir o sistema pela tela inicial.",
      });
    } else {
      rememberDismissal();
    }
  }, [rememberDismissal]);

  useEffect(() => {
    // No iOS, `beforeinstallprompt` não existe — usamos detecção manual
    if (isIOS) {
      const timeout = window.setTimeout(() => {
        if (!shouldSkipPrompt()) setCanInstall(true);
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event as InstallPromptEvent;
      if (!shouldSkipPrompt()) {
        setCanInstall(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, [isIOS, shouldSkipPrompt]);

  // Se já está instalado, não mostra nada
  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {canInstall && (
        <div className="fixed bottom-6 right-6 z-50 max-[559px]:bottom-[calc(5.75rem+env(safe-area-inset-bottom))] max-[559px]:right-3">
          <AnimatePresence mode="wait">
            {showCard && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute bottom-16 right-0 w-72 max-[559px]:bottom-12 max-[559px]:right-0 max-[559px]:w-64"
              >
                <Card size="sm" className="shadow-lg">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-1">
                        <CardTitle>Instale o CorreTop</CardTitle>
                        <CardDescription>
                          {isIOS
                            ? "Toque no botão Compartilhar e depois em \"Adicionar à Tela de Início\"."
                            : "Acesse o sistema direto da tela inicial, mesmo offline."}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={rememberDismissal}
                        className="mt-0.5 shrink-0"
                      >
                        <X />
                      </Button>
                    </div>
                  </CardHeader>
                  <div className="flex gap-2 px-4 pb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={rememberDismissal}
                    >
                      Agora não
                    </Button>
                    {isIOS ? (
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => {
                          toast.info("Como instalar no iOS", {
                            description:
                              "Abra o Safari, toque no ícone Compartilhar (📤) e selecione \"Adicionar à Tela de Início\".",
                            duration: 6000,
                          });
                          rememberDismissal();
                        }}
                      >
                        <ArrowSquareOut className="size-3.5" />
                        Como fazer
                      </Button>
                    ) : (
                      <Button size="sm" className="flex-1" onClick={() => void installApp()}>
                        Instalar
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            onClick={() => setShowCard((prev) => !prev)}
            className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 max-[559px]:size-10"
            aria-label="Instalar CorreTop"
          >
            <FileArrowDown className="size-5 max-[559px]:size-4" />
          </motion.button>
        </div>
      )}
    </AnimatePresence>
  );
}

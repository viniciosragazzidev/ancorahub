"use client";

import { useEffect, useState, startTransition, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Fingerprint, X } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { authClient } from "@/shared/auth/client";
import { recordSecurityAuditAction } from "@/app/(dashboard)/settings/security-actions";

export function PasskeyToastHandler({ userId }: { userId: string }) {
  const router = useRouter();
  const [showCard, setShowCard] = useState(false);

  const dismissForever = useCallback(() => {
    try {
      localStorage.setItem(`passkey-prompt-dismissed:${userId}`, "true");
    } catch {
      // localStorage error fallback
    }
    void recordSecurityAuditAction("dispensou_toast_passkey");
    setShowCard(false);
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return;

    try {
      if (localStorage.getItem(`passkey-prompt-dismissed:${userId}`) === "true") return;
    } catch {
      // localStorage error fallback
    }

    let isMounted = true;

    async function checkPasskeys() {
      try {
        const result = await authClient.passkey.listUserPasskeys();
        if (!isMounted) return;
        if (result.data && Array.isArray(result.data) && result.data.length === 0) {
          setShowCard(true);
        }
      } catch (error) {
        console.error("Erro ao verificar passkeys do usuário:", error);
      }
    }

    void checkPasskeys();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return (
    <AnimatePresence>
      {showCard && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="fixed bottom-6 right-6 z-50 w-72 max-[559px]:bottom-[calc(5.75rem+env(safe-area-inset-bottom))] max-[559px]:right-3 max-[559px]:w-64"
        >
          <Card size="sm" className="shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <CardTitle>Cadastre sua Biometria</CardTitle>
                  <CardDescription>
                    Acesse sua conta em 1 toque usando Face ID ou digital do aparelho.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={dismissForever}
                  aria-label="Fechar notificação"
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
                onClick={dismissForever}
              >
                Agora não
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  setShowCard(false);
                  startTransition(() => {
                    router.push("/settings?tab=seguranca#passkey-section");
                  });
                }}
              >
                <Fingerprint className="size-3.5" />
                Cadastrar
              </Button>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

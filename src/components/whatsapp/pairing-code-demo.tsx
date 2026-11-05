"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { CheckCircle, WhatsappLogo } from "@/components/huge-icons";
import { PRESENCE_WHATSAPP_COPY } from "@/features/waha-cadence/pairing-copy";
import { cn } from "@/utils/core/cn";

/**
 * Mini celular animado (05/11): mostra, em loop, os toques para digitar o código de conexão no WhatsApp.
 * Sem movimento reduzido, troca de passo a cada 2,2 s; com movimento reduzido, fica parado no passo e o
 * corretor avança pelos pontinhos.
 */
const STEP_MS = 2_200;

export function PairingCodeDemo({ code }: { code?: string | null }) {
  const reduce = useReducedMotion();
  const steps = PRESENCE_WHATSAPP_COPY.demo;
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    if (reduce) return;
    const timer = window.setInterval(() => setStep((current) => (current + 1) % steps.length), STEP_MS);
    return () => window.clearInterval(timer);
  }, [reduce, steps.length]);

  const shownCode = (code ?? "ABCD-1234").replace(/[^A-Z0-9]/gi, "").padEnd(8, "•").slice(0, 8);

  return (
    <figure className="flex flex-col items-center gap-ds-8" aria-label="Como digitar o código no WhatsApp">
      <div className="relative h-52 w-32 overflow-hidden rounded-ds-cards border border-ds-ash bg-ds-canvas-white p-ds-8" aria-hidden="true">
        <div className="mb-ds-8 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-ds-charcoal"><WhatsappLogo className="size-3 text-success" /> WhatsApp</span>
          <span className={cn("rounded-full px-1 text-[10px] text-ds-fog", step === 0 && "bg-success/15 text-success")}>⋮</span>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-1.5"
          >
            {step === 0 ? (
              <>
                {["Conversas", "Status", "Ligações"].map((item) => <div key={item} className="h-3 rounded-full bg-ds-ash/60" />)}
                <Tap className="right-1.5 top-2" />
              </>
            ) : step === 1 ? (
              <>
                <MenuRow label="Novo grupo" />
                <MenuRow label="Dispositivos conectados" highlight />
                <MenuRow label="Configurações" />
              </>
            ) : step === 2 ? (
              <div className="space-y-2 pt-2 text-center">
                <div className="mx-auto size-10 rounded-ds-cards border border-ds-ash" />
                <MenuRow label="Conectar dispositivo" highlight centered />
              </div>
            ) : step === 3 ? (
              <div className="space-y-2 pt-1 text-center">
                <div className="mx-auto size-14 rounded-ds-cards border border-dashed border-ds-ash" />
                <p className="text-[9px] leading-tight text-success underline">Conectar com número de telefone</p>
              </div>
            ) : step === 4 ? (
              <div className="space-y-2 pt-3">
                <div className="grid grid-cols-4 gap-0.5">
                  {shownCode.split("").map((char, index) => (
                    <motion.span
                      key={index}
                      initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: reduce ? 0 : index * 0.12 }}
                      className="grid h-4 place-items-center rounded border border-ds-ash text-[8px] font-semibold tabular-nums text-ds-charcoal"
                    >
                      {char}
                    </motion.span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid place-items-center gap-1 pt-6 text-center">
                <CheckCircle className="size-8 text-success" />
                <p className="text-[10px] font-semibold text-ds-charcoal">Conectado!</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <figcaption className="min-h-10 max-w-60 text-center text-ds-caption text-ds-charcoal" aria-live="polite">
        <span className="font-semibold tabular-nums">{step + 1}.</span> {steps[step]}
      </figcaption>
      <div className="flex gap-1" role="tablist" aria-label="Passos">
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={index === step}
            aria-label={`Passo ${index + 1}`}
            onClick={() => setStep(index)}
            className={cn("h-1.5 rounded-full transition-all", index === step ? "w-4 bg-success" : "w-1.5 bg-ds-ash")}
          />
        ))}
      </div>
    </figure>
  );
}

function MenuRow({ label, highlight = false, centered = false }: { label: string; highlight?: boolean; centered?: boolean }) {
  return (
    <div className={cn("relative rounded-full px-1.5 py-1 text-[9px] leading-tight text-ds-charcoal", centered && "text-center", highlight ? "bg-success/15 font-semibold text-success" : "bg-ds-ash/40")}>
      {label}
      {highlight ? <Tap className="-right-0.5 top-1/2 -translate-y-1/2" /> : null}
    </div>
  );
}

/** O "dedo" tocando: um pulso no ponto do toque. */
function Tap({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className={cn("absolute size-3 rounded-full border-2 border-success", className)}
      initial={reduce ? false : { scale: 0.4, opacity: 0.9 }}
      animate={reduce ? undefined : { scale: 1.3, opacity: 0 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "easeOut" }}
    />
  );
}

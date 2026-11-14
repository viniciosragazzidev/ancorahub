"use client";

import { useId, useOptimistic, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { motionTokens } from "@/components/arc/motion-tokens";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import page from "@/components/lite/page/lite-page.module.css";

import { acceptLeadOfferAction } from "@/features/leads/accept-offer-action";
import { openWhatsApp, prepareWhatsAppWindow } from "@/lib/whatsapp-open";
import { rememberWhatsAppHandoff, useAcceptHandoffEnabled } from "@/features/broker-workspace/whatsapp-handoff/handoff-store";

/**
 * "Aceitar e chamar no WhatsApp" in the Lite workspace: one tap accepts the
 * lead (which already starts the service) and opens the client's WhatsApp
 * (WhatsApp Web on the computer, the app on the phone); the CRM tab goes to
 * the lead. The WhatsApp Web tab is opened inside the click, before the
 * await, so popup blockers let it through; a failed accept closes it.
 *
 * Resposta otimista (Doherty, 400 ms): no toque o botão já mostra "Lead aceito" e fica travado
 * (nunca aceita duas vezes). Se o servidor recusar (outro corretor pegou, oferta expirou), o
 * `useOptimistic` volta sozinho ao rótulo original e o erro da action aparece junto do botão.
 */
function AcceptedLabel() {
  return <span className="inline-flex items-center gap-1.5"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>Lead aceito</span>;
}

export function AcceptLeadButton({ leadId, className, children, style, appearance = "legacy", disabled = false, "data-tour": dataTour }: { leadId: string; className?: string; children: ReactNode; style?: CSSProperties; appearance?: "legacy" | "shared"; disabled?: boolean; "data-tour"?: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [pending, startTransition] = useTransition();
  const [accepted, setAccepted] = useOptimistic(false);
  // Aceite com contador (11/11): ligado, nada abre no clique; a tela do lead conta 30 s e abre.
  const handoff = useAcceptHandoffEnabled();
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  function handleClick() {
    if (inFlight.current || pending || disabled) return;
    inFlight.current = true;
    setError(null);
    const whatsapp = handoff ? { go: () => false, cancel: () => {} } : prepareWhatsAppWindow();
    startTransition(async () => {
      setAccepted(true);
      let result: Awaited<ReturnType<typeof acceptLeadOfferAction>>;
      try {
        result = await acceptLeadOfferAction(leadId);
      } catch {
        result = { success: false };
      }
      if (!result.success) {
        whatsapp.cancel();
        const message = result.error ? `${result.error} Atualizei a sua lista.` : "Não deu para aceitar agora. Tente de novo; se o lead sumir, outro corretor já pegou.";
        setError(message);
        inFlight.current = false;
        toast.error(message);
        router.refresh();
        return;
      }
      const url = result.whatsappUrl;
      if (handoff && url) {
        rememberWhatsAppHandoff(leadId, url);
      } else if (url && whatsapp.go(url)) {
        toast.success("Lead aceito. Abrindo o WhatsApp do cliente.", { action: { label: "Abrir de novo", onClick: () => openWhatsApp(url) } });
      } else if (url) {
        whatsapp.cancel();
        toast.success("Lead aceito. Abra o WhatsApp para continuar.", { action: { label: "Abrir WhatsApp", onClick: () => openWhatsApp(url) } });
      } else {
        whatsapp.cancel();
        toast.success("Lead aceito. Ele não tem WhatsApp no cadastro: veja o contato na ficha.");
      }
      router.push(`/leads/${leadId}`);
    });
  }

  if (appearance === "shared") return <div className="grid min-w-0 gap-2">
    <Button type="button" className={[page.primaryButton, className].filter(Boolean).join(" ")} style={style} data-tour={dataTour} data-state={accepted ? "accepted" : undefined} disabled={disabled || pending} aria-busy={pending || undefined} aria-describedby={error ? errorId : undefined} onClick={handleClick}>{accepted ? <AcceptedLabel /> : children}</Button>
    {error ? <p id={errorId} role="alert" className="max-w-sm text-sm text-destructive">{error}</p> : null}
  </div>;

  return (
    <motion.button
      type="button"
      className={className}
      style={style}
      data-tour={dataTour}
      data-state={accepted ? "accepted" : undefined}
      disabled={pending || disabled}
      aria-busy={pending}
      onClick={handleClick}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={motionTokens.spring.snappy}
    >
      {accepted ? <AcceptedLabel /> : children}
    </motion.button>
  );
}

"use client";

import { useId, useOptimistic, useRef, useState, useTransition, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { motionTokens } from "@/components/arc/motion-tokens";
import { flyLeadArc } from "@/components/lite/motion/lead-arc";
import { LiteSuccess } from "@/components/lite/motion/success";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import page from "@/components/lite/page/lite-page.module.css";
import { AcceptLeadIcon, OfferPendingTag, acceptLeadButtonClass, useOfferPendingAttributes } from "@/features/broker-workspace/components/accept-lead-style";

import { acceptLeadOfferAction } from "@/features/leads/accept-offer-action";
import { currentWhatsAppDevice, openWhatsApp, prepareWhatsAppWindow, watchWhatsAppLeave } from "@/lib/whatsapp-open";
import { rememberWhatsAppHandoff, reportWhatsAppOpenFailed, useAcceptHandoffEnabled } from "@/features/broker-workspace/whatsapp-handoff/handoff-store";

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
 *
 * Confirmação no próprio botão: enquanto o servidor responde, "Lead aceito" fica com o lugar do check
 * reservado; quando o aceite confirma, o `LiteSuccess` desenha o check ali (0,32 s, `duration.draw`). Com
 * movimento reduzido ou o kill-switch html[data-interface-motion="off"], o check já aparece pronto.
 *
 * Visual (14/11): o mesmo em todo o app, verde de ação positiva com o raio num círculo (accept-lead-style).
 * `offerPending` (o botão principal da Home quando há oferta esperando): etiqueta "Oferta pendente", anel
 * em volta e, com movimento ligado, o anel pulsa a cada 2 s. Para quando aceita, encerra ou a oferta some.
 */
function AcceptedLabel() {
  // Mesmo tamanho e espaçamento do LiteSuccess (ícone 16 px, gap 8 px): a troca não mexe na largura.
  return <span className="inline-flex items-center gap-2" data-accept-feedback="pending"><span aria-hidden="true" className="inline-block size-4 shrink-0" />Lead aceito</span>;
}

function ConfirmedLabel() {
  return <LiteSuccess label="Lead aceito" />;
}

export function AcceptLeadButton({ leadId, className, children, style, appearance = "legacy", disabled = false, arcToLeads = false, offerPending = false, "data-tour": dataTour }: { leadId: string; className?: string; children: ReactNode; style?: CSSProperties; appearance?: "legacy" | "shared"; disabled?: boolean; /** Ponto em arco até a contagem de Leads ao aceitar (só o "Seu próximo passo"; ver lead-arc.ts). */ arcToLeads?: boolean; /** Oferta esperando o corretor: etiqueta, anel e pulso em loop (Home). */ offerPending?: boolean; "data-tour"?: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const motionEnabled = useInterfaceMotionEnabled();
  const [pending, startTransition] = useTransition();
  const [accepted, setAccepted] = useOptimistic(false);
  // Aceite confirmado pelo servidor: estado real (o otimista some quando a transição termina).
  const [confirmed, setConfirmed] = useState(false);
  // Aceite com contador (11/11): ligado, nada abre no clique; a tela do lead conta 30 s e abre.
  const handoff = useAcceptHandoffEnabled();
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (inFlight.current || pending || disabled || confirmed) return;
    const origin = event.currentTarget;
    inFlight.current = true;
    setError(null);
    // Contador de 30 s só no computador (14/11). No celular o navegador barra abrir o app sem um toque
    // recente, então aos 30 s falhava: lá o WhatsApp abre direto, aproveitando este toque.
    const device = currentWhatsAppDevice();
    const counting = handoff && device === "desktop";
    const whatsapp = counting ? { go: () => false, cancel: () => {} } : prepareWhatsAppWindow(device);
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
      setConfirmed(true);
      if (arcToLeads) flyLeadArc(origin, { motionEnabled });
      const url = result.whatsappUrl;
      // Celular: vigia se o app abriu; se a página continuar visível, a tela do lead pede o toque.
      const leave = !counting && url && device === "mobile" ? watchWhatsAppLeave() : null;
      if (counting && url) {
        rememberWhatsAppHandoff(leadId, url);
      } else if (url && whatsapp.go(url)) {
        if (leave) void leave.then((outcome) => { if (outcome === "failed") reportWhatsAppOpenFailed(leadId, url); });
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

  const settled = confirmed || accepted;
  const label = confirmed ? <ConfirmedLabel /> : accepted ? <AcceptedLabel /> : <><AcceptLeadIcon />{offerPending && !disabled ? <OfferPendingTag /> : null}<span>{children}</span></>;
  // Pendente só enquanto dá para aceitar; o loop só com movimento ligado (reduzido e kill-switch: anel parado).
  const showPending = offerPending && !disabled && !settled;
  const pendingProps = useOfferPendingAttributes(showPending);
  const classes = [acceptLeadButtonClass, className].filter(Boolean).join(" ");

  if (appearance === "shared") return <div className="grid min-w-0 gap-2">
    <Button type="button" variant="success" className={[page.primaryButton, classes].join(" ")} style={style} {...pendingProps} data-tour={dataTour} data-state={confirmed || accepted ? "accepted" : undefined} data-confirmed={confirmed || undefined} disabled={disabled || pending || confirmed} aria-busy={pending || undefined} aria-describedby={error ? errorId : undefined} onClick={handleClick}>{label}</Button>
    {error ? <p id={errorId} role="alert" className="max-w-sm text-sm text-destructive">{error}</p> : null}
  </div>;

  return (
    <motion.button
      type="button"
      className={classes}
      style={style}
      {...pendingProps}
      data-tour={dataTour}
      data-state={confirmed || accepted ? "accepted" : undefined}
      data-confirmed={confirmed || undefined}
      disabled={pending || disabled || confirmed}
      aria-busy={pending}
      onClick={handleClick}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={motionTokens.spring.snappy}
    >
      {label}
    </motion.button>
  );
}

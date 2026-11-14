"use client";

import { useEffect, useId, useRef, useState, useTransition, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { motionTokens } from "@/components/arc/motion-tokens";
import { flyLeadArc } from "@/components/lite/motion/lead-arc";
import { LiteSuccess } from "@/components/lite/motion/success";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import page from "@/components/lite/page/lite-page.module.css";
import { AcceptLeadIcon, OfferPendingTag, acceptLeadButtonClass, useOfferPendingAttributes } from "@/features/broker-workspace/components/accept-lead-style";
import { normalizeActionError } from "@/lib/feedback/action-error";
import { useFeedback } from "@/lib/feedback/use-feedback";

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
 * Feedback padrão (docs/design-system/FEEDBACK.md, nível 1), igual ao protótipo do aceite:
 * - toque: o botão afunda sobre a base sólida e vibra curto (`tap`);
 * - enviando: "Aceitando…" com spinner, travado (nunca aceita duas vezes); o sucesso só aparece
 *   depois que o servidor confirma;
 * - confirmado: o `LiteSuccess` desenha o check de "Lead aceito" (0,32 s) e vibra `confirm`, sem som
 *   (aceite é ação de dezenas por dia);
 * - falhou: fica vermelho com X e balança (2 × 4 px, 250 ms), toca o som de erro, mostra a causa abaixo
 *   e, depois de 1,4 s, volta verde como "Tentar de novo". Sem toast duplicando o erro.
 * Com movimento reduzido ou o kill-switch, nada desloca: as trocas são diretas.
 *
 * Visual (14/11): o mesmo em todo o app, verde de ação positiva com o raio num círculo (accept-lead-style).
 * `offerPending` (o botão principal da Home quando há oferta esperando): etiqueta "Oferta pendente", anel
 * em volta e, com movimento ligado, o anel pulsa a cada 2 s. Para quando aceita, encerra ou a oferta some.
 */
type Phase = "idle" | "busy" | "done" | "error";

function BusyLabel() {
  // Mesmo tamanho e espaçamento do LiteSuccess (ícone 16 px, gap 8 px): a troca não mexe na largura.
  return (
    <span className="inline-flex items-center gap-2" data-accept-feedback="pending">
      <span aria-hidden="true" className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
      Aceitando…
    </span>
  );
}

function FailedLabel() {
  return (
    <span className="inline-flex items-center gap-2" data-accept-feedback="failed">
      <X aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.6} />
      Não deu certo
    </span>
  );
}

export function AcceptLeadButton({ leadId, className, children, style, appearance = "legacy", disabled = false, arcToLeads = false, offerPending = false, "data-tour": dataTour }: { leadId: string; className?: string; children: ReactNode; style?: CSSProperties; appearance?: "legacy" | "shared"; disabled?: boolean; /** Ponto em arco até a contagem de Leads ao aceitar (só o "Seu próximo passo"; ver lead-arc.ts). */ arcToLeads?: boolean; /** Oferta esperando o corretor: etiqueta, anel e pulso em loop (Home). */ offerPending?: boolean; "data-tour"?: string }) {
  const router = useRouter();
  const motionEnabled = useInterfaceMotionEnabled();
  const fire = useFeedback();
  const [, startTransition] = useTransition();
  const [phase, setPhase] = useState<Phase>("idle");
  const [retry, setRetry] = useState(false);
  // Aceite com contador (11/11): ligado, nada abre no clique; a tela do lead conta 30 s e abre.
  const handoff = useAcceptHandoffEnabled();
  const inFlight = useRef(false);
  const revertTimer = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  useEffect(() => () => { if (revertTimer.current) window.clearTimeout(revertTimer.current); }, []);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (inFlight.current || disabled || phase === "done") return;
    const origin = event.currentTarget;
    inFlight.current = true;
    setError(null);
    setPhase("busy");
    fire("tap");
    // Contador de 30 s só no computador (14/11). No celular o navegador barra abrir o app sem um toque
    // recente, então aos 30 s falhava: lá o WhatsApp abre direto, aproveitando este toque.
    const device = currentWhatsAppDevice();
    const counting = handoff && device === "desktop";
    const whatsapp = counting ? { go: () => false, cancel: () => {} } : prepareWhatsAppWindow(device);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof acceptLeadOfferAction>>;
      try {
        result = await acceptLeadOfferAction(leadId);
      } catch {
        result = { success: false };
      }
      if (!result.success) {
        whatsapp.cancel();
        const cause = result.error ? normalizeActionError({ error: result.error }, "Não deu para aceitar agora").cause : null;
        const message = cause ? `${cause} Atualizei a sua lista.` : "Não deu para aceitar agora. Tente de novo; se o lead sumir, outro corretor já pegou.";
        setError(message);
        setPhase("error");
        fire("error");
        revertTimer.current = window.setTimeout(() => {
          setPhase("idle");
          setRetry(true);
          inFlight.current = false;
        }, motionTokens.celebration.revertAfter * 1000);
        router.refresh();
        return;
      }
      setPhase("done");
      fire("confirm");
      if (arcToLeads) flyLeadArc(origin, { motionEnabled });
      const url = result.whatsappUrl;
      // Celular: vigia se o app abriu; se a página continuar visível, a tela do lead pede o toque.
      const leave = !counting && url && device === "mobile" ? watchWhatsAppLeave() : null;
      if (counting && url) {
        rememberWhatsAppHandoff(leadId, url);
      } else if (url && whatsapp.go(url)) {
        if (leave) void leave.then((outcome) => { if (outcome === "failed") reportWhatsAppOpenFailed(leadId, url); });
        // Trabalho externo (o WhatsApp abrindo em outra aba): o toast fica pela ação "Abrir de novo".
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

  const busy = phase === "busy";
  const confirmed = phase === "done";
  const settled = busy || confirmed;
  const label = confirmed ? <LiteSuccess label="Lead aceito" />
    : busy ? <BusyLabel />
    : phase === "error" ? <FailedLabel />
    : <><AcceptLeadIcon />{offerPending && !disabled && !retry ? <OfferPendingTag /> : null}<span>{retry ? "Tentar de novo" : children}</span></>;
  // Pendente só enquanto dá para aceitar; o loop só com movimento ligado (reduzido e kill-switch: anel parado).
  const showPending = offerPending && !disabled && phase === "idle";
  const pendingProps = useOfferPendingAttributes(showPending);
  const classes = [acceptLeadButtonClass, className].filter(Boolean).join(" ");
  const dataState = phase === "error" ? "error" : settled ? "accepted" : undefined;
  const common = {
    type: "button" as const,
    style,
    ...pendingProps,
    "data-tour": dataTour,
    "data-state": dataState,
    "data-confirmed": confirmed || undefined,
    "data-motion": motionEnabled ? "on" : "off",
    disabled: disabled || busy || confirmed,
    "aria-busy": busy || undefined,
    "aria-describedby": error ? errorId : undefined,
    onClick: handleClick,
  };

  const alert = error ? <p id={errorId} role="alert" className="max-w-sm text-sm text-destructive">{error}</p> : null;

  if (appearance === "shared") return <div className="grid min-w-0 gap-2">
    <Button variant="success" className={[page.primaryButton, classes].join(" ")} {...common}>{label}</Button>
    {alert}
  </div>;

  if (!alert) return <button className={classes} {...common}>{label}</button>;
  return (
    <span className="inline-grid min-w-0 gap-2">
      <button className={classes} {...common}>{label}</button>
      {alert}
    </span>
  );
}

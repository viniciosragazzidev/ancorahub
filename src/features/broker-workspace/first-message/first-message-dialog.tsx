"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { pollWhatsAppConnection, startWhatsAppConnection } from "@/app/(dashboard)/settings/whatsapp-actions";
import { PairingQrPanel } from "@/components/whatsapp/whatsapp-pairing-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { derivePairingPhase, FIRST_QR_LIFETIME_SECONDS, ROTATED_QR_LIFETIME_SECONDS } from "@/features/waha-cadence/pairing-phase";

import { getFirstMessageContextAction, sendFirstMessageAction, type FirstMessageContext } from "./actions";
import { FIRST_MESSAGE_MAX_LENGTH } from "./first-message";

type Step = "loading" | "compose" | "offer" | "guide" | "qr" | "connected" | "sending" | "done" | "error";
type Ready = Extract<FirstMessageContext, { ok: true }>;

const ADVANTAGES = [
  { title: "Manda daqui, sem trocar de tela", text: "A primeira mensagem sai do seu WhatsApp direto do computador." },
  { title: "Fica registrado no lead", text: "A mensagem aparece na conversa e o atendimento começa na hora." },
  { title: "Você continua no celular", text: "A resposta do cliente chega no seu WhatsApp, como sempre." },
];

const GUIDE = [
  { title: "Abra o WhatsApp no celular", text: "O mesmo número que você usa com os clientes." },
  { title: "Vá em Aparelhos conectados", text: "Android: toque nos 3 pontinhos. iPhone: toque em Configurações." },
  { title: "Toque em Conectar um aparelho", text: "A câmera abre. No próximo passo, aponte para o QR code da tela." },
];

const POLL_MS = 1_500;

/** Always visible: whether the broker's WhatsApp is connected (and a way to connect when it is not). */
function ConnectionPill({ connected }: { connected: boolean }) {
  return (
    <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${connected ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
      <span className={`size-2 rounded-full ${connected ? "bg-success" : "bg-muted-foreground/60"}`} aria-hidden />
      {connected ? "Seu WhatsApp está conectado" : "Seu WhatsApp não está conectado"}
    </span>
  );
}

/**
 * "Chamar no WhatsApp" on the computer: the first message goes from the broker's
 * own WhatsApp through the system (decision 2026-10-10); not connected, the
 * broker can connect here (guide + QR, same dialog) or open the WhatsApp.
 */
export function FirstMessageDialog({ leadId, open, onOpenChange, onSent }: { leadId: string; open: boolean; onOpenChange: (open: boolean) => void; onSent?: () => void }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>("loading");
  const [data, setData] = useState<Ready | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guideIndex, setGuideIndex] = useState(0);
  const [qr, setQr] = useState<{ code: string | null; key: number; shownAt: number; lifetime: number }>({ code: null, key: 0, shownAt: 0, lifetime: FIRST_QR_LIFETIME_SECONDS });
  const [now, setNow] = useState(() => Date.now());
  const [webUrl, setWebUrl] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);
  const [connected, setConnected] = useState(false);
  const polling = useRef(false);

  // Each opening starts over from the server state (connection may have changed).
  useEffect(() => {
    if (!open) { polling.current = false; return; }
    let cancelled = false;
    getFirstMessageContextAction(leadId).then((result) => {
      if (cancelled) return;
      if (!result.ok) { setError(result.error); setStep("error"); return; }
      setData(result);
      setText(result.message);
      setError(null);
      setGuideIndex(0);
      setStep(result.alreadySent ? "done" : result.connected ? "compose" : "offer");
      setWebUrl(result.webUrl);
      setJustSent(false);
      setConnected(result.connected);
    });
    return () => { cancelled = true; };
  }, [open, leadId]);

  const showQr = useCallback((code: string) => {
    setQr((current) => (current.code === code ? current : { code, key: current.key + 1, shownAt: Date.now(), lifetime: current.code ? ROTATED_QR_LIFETIME_SECONDS : FIRST_QR_LIFETIME_SECONDS }));
  }, []);

  // While the QR is on screen: poll until the phone connects, then back to the message.
  useEffect(() => {
    if (step !== "qr" || !open) return;
    polling.current = true;
    const clock = window.setInterval(() => setNow(Date.now()), 500);
    let timer = 0;
    const tick = async () => {
      if (!polling.current) return;
      const result = await pollWhatsAppConnection().catch(() => null);
      if (!polling.current) return;
      if (result && result.success) {
        if (result.status === "ready") {
          polling.current = false;
          setConnected(true);
          setStep("connected");
          window.setTimeout(() => setStep("compose"), reduce ? 400 : 1_400);
          return;
        }
        if (result.qrCode) showQr(result.qrCode);
      }
      timer = window.setTimeout(tick, POLL_MS);
    };
    timer = window.setTimeout(tick, POLL_MS);
    return () => { polling.current = false; window.clearInterval(clock); window.clearTimeout(timer); };
  }, [step, open, reduce, showQr]);

  async function connect() {
    setError(null);
    setStep("qr");
    const result = await startWhatsAppConnection().catch(() => null);
    if (!result || !result.success) { setError("Não consegui gerar o QR code agora. Tente de novo em instantes."); setStep("guide"); return; }
    if (result.status === "ready") { setConnected(true); setStep("compose"); return; }
    if (result.qrCode) showQr(result.qrCode);
  }

  async function send() {
    setError(null);
    setStep("sending");
    const result = await sendFirstMessageAction({ leadId, text });
    if (result.ok) { setWebUrl(result.webUrl ?? webUrl); setJustSent(true); setStep("done"); onSent?.(); return; }
    setError(result.error);
    if (result.code === "not_connected") setConnected(false);
    setStep(result.code === "already_sent" ? "done" : result.code === "not_connected" ? "offer" : "compose");
  }

  const secondsLeft = qr.shownAt ? Math.ceil(qr.lifetime - (now - qr.shownAt) / 1_000) : qr.lifetime;
  const phase = derivePairingPhase({ status: "initializing", providerStatus: qr.code ? "SCAN_QR_CODE" : null, hasQr: Boolean(qr.code), sawQr: qr.key > 0 });
  const name = data?.leadFirstName || "o cliente";
  const motionProps = reduce ? {} : { initial: { opacity: 0, x: 16 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -16 }, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const } };

  const fallbackLinks = data?.appUrl || data?.webUrl ? (
    <div className="flex flex-wrap gap-2">
      {data?.webUrl ? <Button variant="outline" size="sm" render={<a href={data.webUrl} target="_blank" rel="noreferrer" />}>Abrir no WhatsApp Web</Button> : null}
      {data?.appUrl ? <Button variant="ghost" size="sm" render={<a href={data.appUrl} target="_blank" rel="noreferrer" />}>Abrir no app do WhatsApp</Button> : null}
    </div>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="arc-venancor max-w-lg overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step === "sending" ? "compose" : step} {...motionProps} className="grid gap-4">
            {step === "loading" ? (
              <>
                <DialogTitle>Chamar no WhatsApp</DialogTitle>
                <DialogDescription>Preparando a mensagem...</DialogDescription>
              </>
            ) : null}

            {step === "error" ? (
              <>
                <DialogTitle>Chamar no WhatsApp</DialogTitle>
                <DialogDescription role="alert">{error}</DialogDescription>
              </>
            ) : null}

            {step === "compose" || step === "sending" ? (
              <>
                <DialogTitle>Primeira mensagem para {name}</DialogTitle>
                <DialogDescription>Sai do seu WhatsApp, direto daqui. Pode editar antes de enviar.</DialogDescription>
                <ConnectionPill connected />
                <Textarea value={text} rows={5} maxLength={FIRST_MESSAGE_MAX_LENGTH} onChange={(event) => setText(event.target.value)} aria-label="Mensagem" disabled={step === "sending"} />
                {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {fallbackLinks}
                  <Button onClick={send} disabled={step === "sending" || !text.trim()}>{step === "sending" ? "Enviando..." : "Enviar"}</Button>
                </div>
              </>
            ) : null}

            {step === "offer" ? (
              <>
                <DialogTitle>Conecte seu WhatsApp e mande daqui</DialogTitle>
                <DialogDescription>Você está no computador. Conectando seu WhatsApp, a primeira mensagem para {name} sai daqui com um clique.</DialogDescription>
                <ConnectionPill connected={false} />
                {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
                <ul className="grid gap-2">
                  {ADVANTAGES.map((item, index) => (
                    <motion.li key={item.title} className="rounded-xl bg-muted/60 p-3" initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 0.05 + index * 0.06 }}>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.text}</p>
                    </motion.li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {fallbackLinks}
                  <Button onClick={() => setStep("guide")}>Conectar meu WhatsApp</Button>
                </div>
              </>
            ) : null}

            {step === "guide" ? (
              <>
                <DialogTitle>Passo {guideIndex + 1} de {GUIDE.length}</DialogTitle>
                <DialogDescription>Leva menos de um minuto.</DialogDescription>
                {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
                <div className="flex gap-1.5" aria-hidden>
                  {GUIDE.map((item, index) => <span key={item.title} className={`h-1.5 flex-1 rounded-full ${index <= guideIndex ? "bg-primary" : "bg-muted"}`} />)}
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={guideIndex} {...motionProps} className="rounded-xl bg-muted/60 p-4">
                    <p className="text-base font-medium text-foreground">{GUIDE[guideIndex]!.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{GUIDE[guideIndex]!.text}</p>
                  </motion.div>
                </AnimatePresence>
                <div className="flex items-center justify-between gap-3">
                  <Button variant="ghost" onClick={() => (guideIndex ? setGuideIndex(guideIndex - 1) : setStep("offer"))}>Voltar</Button>
                  {guideIndex < GUIDE.length - 1
                    ? <Button onClick={() => setGuideIndex(guideIndex + 1)}>Próximo</Button>
                    : <Button onClick={connect}>Mostrar o QR code</Button>}
                </div>
              </>
            ) : null}

            {step === "qr" ? (
              <>
                <DialogTitle>Aponte o celular para o QR code</DialogTitle>
                <DialogDescription>Em Aparelhos conectados, toque em Conectar um aparelho. Quando conectar, a mensagem volta para você enviar.</DialogDescription>
                <PairingQrPanel phase={phase} qrCode={qr.code} secondsLeft={secondsLeft} lifetime={qr.lifetime} qrKey={qr.key} />
                <div className="flex justify-start">
                  <Button variant="ghost" onClick={() => setStep("guide")}>Voltar ao passo a passo</Button>
                </div>
              </>
            ) : null}

            {step === "connected" ? (
              <>
                <DialogTitle>WhatsApp conectado</DialogTitle>
                <DialogDescription>Pronto. Agora é só enviar a primeira mensagem para {name}.</DialogDescription>
              </>
            ) : null}

            {step === "done" ? (
              <>
                <DialogTitle>{justSent ? `Mensagem enviada para ${name}` : "A primeira mensagem já foi enviada"}</DialogTitle>
                <DialogDescription>{justSent ? "Agora continue pelo seu celular ou pelo WhatsApp Web. A resposta do cliente chega no seu WhatsApp." : `Você já escreveu para ${name}. Continue a conversa pelo seu celular ou pelo WhatsApp Web.`}</DialogDescription>
                <ConnectionPill connected={connected} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {webUrl ? <Button variant="outline" render={<a href={webUrl} target="_blank" rel="noreferrer" />}>Abrir o WhatsApp Web</Button> : null}
                    {!connected ? <Button variant="ghost" onClick={() => { setGuideIndex(0); setStep("guide"); }}>Conectar meu WhatsApp</Button> : null}
                  </div>
                  <Button onClick={() => onOpenChange(false)}>Fechar</Button>
                </div>
              </>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </DialogPopup>
    </Dialog>
  );
}

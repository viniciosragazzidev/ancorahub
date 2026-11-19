"use client";

/**
 * Botão flutuante da Sasá (fase 3, 19/11/2026): em todo o Lite do corretor, segurar grava, soltar envia, arrastar
 * para a esquerda cancela, sem abrir a conversa. A resposta vem num toast com uma ação (Desfazer) ou, quando
 * pede escolha ou mostra uma lista, numa folha curta com os mesmos blocos da conversa.
 * Sem internet, o áudio espera no aparelho e sai quando a conexão volta (regra dos 30 min no servidor).
 * Feedback (FEEDBACK.md): toque no início, confirmação só depois do servidor, erro com a causa; sem som nem celebração.
 * Plano: docs/implementations/active/2026-11-19-sasa-agentica.md §4.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import BottomSheet from "@/components/arc/bottom-sheet/bottom-sheet";
import { askAssistantAction } from "@/features/ai-gateway/ask-assistant";
import { runChatServerAction } from "@/features/broker-workspace/chat/chat-actions";
import { sasaCommandAction } from "@/features/sasa/command-action";
import { isOfflineError, sasaQueue, type SasaQueued } from "@/features/sasa/offline-queue";
import { keepSasaOpen } from "@/features/sasa/drafts";
import { sasaReplyFitsToast, transcribeSasaVoice, undoOf } from "@/features/sasa/voice-client";
import { sasaVoiceRouteHidden, useSasaVoiceSurface } from "@/features/sasa/voice-visibility";
import { useDevLab } from "@/lib/dev-lab";
import { useFeedback } from "@/lib/feedback/use-feedback";

import { AssistantAvatar } from "./assistant-avatar";
import { AssistantChat } from "./assistant-chat";
import { feedbackOnResult } from "./chat-feedback";
import type { ChatBlock, ChatServerActionName } from "./types";
import { newClientMessageId } from "./user-send-core";
import { useVoiceRecorder, voiceClock, VOICE_CANCEL_PX } from "./voice-recorder";
import styles from "./sasa-voice-button.module.css";

type Undo = { name: ChatServerActionName; payload: Record<string, string | number | boolean | null> };
type Toast = { id: number; heard: string | null; text: string; tone: "info" | "error"; undo: Undo | null };
type Sheet = { key: number; heard: string; blocks: ChatBlock[] };

const TOAST_MS = 6000;
const SASA = { name: "Sasá", shape: "sasa" as const, hue: 175 };

export function SasaVoiceButton({ pathname, chat }: { pathname: string; chat: boolean }) {
  const lab = useDevLab();
  const router = useRouter();
  const fire = useFeedback();
  const reduce = useReducedMotion();
  const surface = useSasaVoiceSurface();
  const [toast, setToast] = useState<Toast | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [queued, setQueued] = useState(0);
  const [clock, setClock] = useState(0);
  const pointerStart = useRef<number | null>(null);
  const working = useRef(false);

  const transcribe = lab?.sasa?.transcribe ?? transcribeSasaVoice;
  const command = lab?.sasa?.command ?? sasaCommandAction;
  const runServer = lab?.sasa ? lab.sasa.run : runChatServerAction;
  const isOffline = () => (lab?.sasa ? Boolean(lab.sasa.offline) : typeof navigator !== "undefined" && !navigator.onLine);

  const refreshQueued = useCallback(() => { void sasaQueue.list().then((items) => setQueued(items.length)); }, []);
  const say = useCallback((text: string, tone: Toast["tone"] = "info", heard: string | null = null, undo: Undo | null = null) => setToast({ id: Date.now(), heard, text, tone, undo }), []);

  const present = useCallback((heard: string, blocks: ChatBlock[]) => {
    if (sasaReplyFitsToast(blocks)) {
      const text = blocks.filter((block): block is Extract<ChatBlock, { type: "assistant" }> => block.type === "assistant").map((block) => block.text).join(" ");
      say(text, "info", heard, undoOf(blocks));
      return;
    }
    setToast(null);
    setSheet({ key: Date.now(), heard, blocks });
  }, [say]);

  /** Um áudio do começo ao fim: texto, pedido, resposta. Sem rede, vai para a fila (se não veio dela). */
  const handle = useCallback(async (item: SasaQueued, fromQueue: boolean) => {
    working.current = true;
    try {
      if (isOffline()) throw new TypeError("offline");
      const heard = await transcribe({ audio: item.audio, seconds: item.seconds, clientCommandId: item.id });
      if (!heard.ok) {
        if (fromQueue) await sasaQueue.remove(item.id);
        fire("error");
        say(heard.error, "error");
        return;
      }
      const reply = await command({ text: heard.text, clientCommandId: item.id, origin: "voice", recordedAt: item.recordedAt });
      if (fromQueue) await sasaQueue.remove(item.id);
      if (reply.executed) feedbackOnResult(reply.executed.action, reply.executed, fire);
      if (reply.open) {
        // Fase 4: abre a venda ou a cotação já preenchidas; o aviso diz o que foi anotado.
        keepSasaOpen(reply.open);
        const text = reply.blocks.find((block): block is Extract<ChatBlock, { type: "assistant" }> => block.type === "assistant")?.text ?? "Abrindo…";
        say(text, "info", heard.text);
        if (lab?.sasa?.open) lab.sasa.open(reply.open);
        else router.push(reply.open.href);
        return;
      }
      const blocks = reply.handled
        ? reply.blocks
        : lab?.sasa?.ask
          ? await lab.sasa.ask(heard.text)
          : lab?.sasa
          ? [{ type: "assistant" as const, id: `lab-free-${Date.now()}`, text: "No laboratório, só os pedidos da Sasá respondem: plantão, pausa, quem está esperando, agenda, retornos e etapa." }]
          : (await askAssistantAction({ agentId: "ancora", question: heard.text, clientCommandId: item.id })).blocks;
      present(heard.text, blocks);
    } catch (error) {
      if (isOfflineError(error, !isOffline())) {
        if (!fromQueue) {
          const saved = await sasaQueue.add(item);
          fire(saved ? "tap" : "error");
          say(saved ? "Sem internet. Guardei o áudio e envio quando a conexão voltar." : "Sem internet e não consegui guardar o áudio. Tente de novo quando a conexão voltar.", saved ? "info" : "error");
        }
      } else {
        if (fromQueue) await sasaQueue.remove(item.id);
        fire("error");
        say("Não consegui falar com o servidor. Nada foi alterado. Tente de novo.", "error");
      }
    } finally {
      working.current = false;
      recorder.done();
      refreshQueued();
    }
    // `recorder` é estável o bastante: done só volta o estado para o repouso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command, fire, lab, present, refreshQueued, router, say, transcribe]);

  const recorder = useVoiceRecorder({
    simulate: Boolean(lab?.sasa?.simulateMic),
    onAudio: (audio, seconds) => { void handle({ id: newClientMessageId(), audio, seconds, recordedAt: new Date().toISOString() }, false); },
    onError: (message) => say(message, "error"),
  });
  const recording = recorder.state.kind === "recording";
  const sending = recorder.state.kind === "sending";

  // Fila: quando a internet volta (ou ao abrir o app), manda o mais antigo; um de cada vez, sem cobrir uma resposta aberta.
  const flush = useCallback(async () => {
    if (working.current || toast || sheet || isOffline()) return;
    const [next] = await sasaQueue.list();
    if (!next) return;
    await handle(next, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, sheet, toast, lab]);
  useEffect(() => {
    refreshQueued();
    const onOnline = () => { void flush(); };
    window.addEventListener("online", onOnline);
    void flush();
    return () => window.removeEventListener("online", onOnline);
  }, [flush, refreshQueued]);

  useEffect(() => {
    if (!recording) return;
    setClock(Date.now());
    const tick = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(tick);
  }, [recording]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const undo = async (action: Undo) => {
    setToast((current) => (current ? { ...current, undo: null } : current));
    const result = await runServer(action.name, action.payload).catch(() => ({ ok: false, message: "" }));
    feedbackOnResult(action.name, result, fire);
    say(result.ok ? "Desfeito. Ficou como estava antes." : "Não consegui desfazer. Abra a conversa da Sasá e tente de novo.", result.ok ? "info" : "error");
  };

  const routeHidden = sasaVoiceRouteHidden(pathname, chat);
  // Gravando ou enviando, o botão fica: esconder no meio do gesto perderia o áudio.
  const show = !routeHidden && (recording || sending || !surface.hidden) && !sheet;
  const label = recording
    ? "Gravando. Solte para enviar ou deslize para a esquerda para cancelar"
    : sending ? "Enviando o áudio para a Sasá"
      : `Segure para falar com a Sasá${queued ? `. ${queued === 1 ? "1 áudio esperando" : `${queued} áudios esperando`} a internet` : ""}`;

  return (
    <>
      {/* arc-venancor: o botão vive fora das telas, e os tokens do Lite (superfície, borda) só existem dentro dessa classe. */}
      <div className={`${styles.dock} arc-venancor`} data-lifted={surface.lifted || undefined} data-sasa-own="">
        <AnimatePresence>
          {toast && !routeHidden ? (
            <motion.div
              key={toast.id}
              className={styles.toast}
              data-tone={toast.tone}
              role="status"
              aria-live="polite"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, transition: { duration: 0.14 } }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className={styles.toastText}>
                {toast.heard ? <span className={styles.heard}>Ouvi: “{toast.heard}”</span> : null}
                <motion.span initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 0.08, duration: 0.16 }}>{toast.text}</motion.span>
              </div>
              {toast.undo ? <button type="button" className={styles.toastAction} onClick={() => void undo(toast.undo!)}>Desfazer</button> : null}
              <button type="button" className={styles.toastClose} aria-label="Fechar aviso" onClick={() => setToast(null)}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {recording && recorder.state.kind === "recording" ? (
          <div className={styles.recording} data-cancelling={recorder.state.cancelling || undefined} role="status" aria-live="polite">
            <span className={styles.dot} data-still={reduce || undefined} aria-hidden="true" />
            <span className={styles.time}>{voiceClock(clock - recorder.state.startedAt)}</span>
            <span>{recorder.state.cancelling ? "Solte para cancelar" : "Deslize para a esquerda para cancelar"}</span>
          </div>
        ) : sending ? (
          <div className={styles.recording} role="status" aria-live="polite">
            <span className={styles.sendingText}>Entendendo o áudio…</span>
          </div>
        ) : null}

        <AnimatePresence>
          {show ? (
            <motion.button
              key="sasa-voice"
              type="button"
              className={styles.button}
              data-recording={recording || undefined}
              data-still={reduce || undefined}
              aria-label={label}
              aria-busy={sending || undefined}
              disabled={sending}
              initial={reduce ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              onPointerDown={(event) => {
                if (event.button !== 0 || recorder.state.kind !== "idle") return;
                event.preventDefault();
                try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* ponteiro já solto */ }
                pointerStart.current = event.clientX;
                setToast(null);
                fire("tap");
                void recorder.start();
              }}
              onPointerMove={(event) => {
                if (pointerStart.current === null) return;
                recorder.setCancelling(pointerStart.current - event.clientX > VOICE_CANCEL_PX);
              }}
              onPointerUp={(event) => {
                if (pointerStart.current === null) return;
                const cancel = pointerStart.current - event.clientX > VOICE_CANCEL_PX;
                pointerStart.current = null;
                recorder.stop(cancel);
              }}
              onPointerCancel={() => { if (pointerStart.current === null) return; pointerStart.current = null; recorder.stop(true); }}
              onKeyDown={(event) => {
                if ((event.key === " " || event.key === "Enter") && !event.repeat && recorder.state.kind === "idle") {
                  event.preventDefault();
                  setToast(null);
                  fire("tap");
                  void recorder.start();
                } else if (event.key === "Escape" && recording) {
                  event.preventDefault();
                  recorder.stop(true);
                }
              }}
              onKeyUp={(event) => { if ((event.key === " " || event.key === "Enter") && recording) { event.preventDefault(); recorder.stop(false); } }}
              onContextMenu={(event) => event.preventDefault()}
            >
              {sending ? (
                <svg viewBox="0 0 16 16" aria-hidden="true" className={styles.spin}><path d="M8 2.5a5.5 5.5 0 1 0 5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              ) : recording ? (
                <svg viewBox="0 0 16 16" aria-hidden="true" className={styles.micBig}><path d="M8 10.5a2.5 2.5 0 0 0 2.5-2.5V4.5a2.5 2.5 0 0 0-5 0V8A2.5 2.5 0 0 0 8 10.5Zm-4.5-3a4.5 4.5 0 0 0 9 0M8 12v2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              ) : (
                <>
                  <AssistantAvatar shape={SASA.shape} hue={SASA.hue} size={40} />
                  <span className={styles.micBadge} aria-hidden="true">
                    <svg viewBox="0 0 16 16"><path d="M8 10.5a2.5 2.5 0 0 0 2.5-2.5V4.5a2.5 2.5 0 0 0-5 0V8A2.5 2.5 0 0 0 8 10.5Zm-4.5-3a4.5 4.5 0 0 0 9 0M8 12v2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  {queued ? <span className={styles.queued} aria-hidden="true">{queued}</span> : null}
                </>
              )}
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>

      <BottomSheet
        open={Boolean(sheet)}
        onOpenChange={(open) => { if (!open) setSheet(null); }}
        title="Sasá"
        description={sheet ? `Ouvi: “${sheet.heard}”` : undefined}
        detents={[0.55, 0.9]}
        closeLabel="Fechar"
        className="arc-venancor"
      >
        {sheet ? (
          <div className={styles.sheetBody}>
            <AssistantChat key={sheet.key} embedded identity={SASA} script={{ blocks: sheet.blocks }} instant agentId="ancora" />
          </div>
        ) : null}
      </BottomSheet>
    </>
  );
}

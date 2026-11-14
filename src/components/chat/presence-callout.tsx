"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";

import { AssistantAvatar } from "./assistant-avatar";
import { CameraCapture, canUseInPageCamera } from "./camera-capture";
import { LiteList, LiteListItem } from "@/components/light/light-motion";
import dynamic from "next/dynamic";
import type { getWhatsAppConnection } from "@/app/(dashboard)/settings/whatsapp-actions";
import { readGuideMemory, type ConfirmStage } from "@/components/chat/presence-guide/presence-guide-steps";

// Carregados só quando a confirmação pede o WhatsApp: o chat não leva o diálogo de conexão à toa.
const WhatsAppConnectDialog = dynamic(() => import("@/components/whatsapp/whatsapp-connect-dialog").then((module) => module.WhatsAppConnectDialog), { ssr: false });
const loadPresenceGate = () => import("@/features/lead-distribution/duty-presence-whatsapp-actions").then((module) => module.getPresenceWhatsAppGateAction());
const loadWhatsAppConnection = () => import("@/app/(dashboard)/settings/whatsapp-actions").then((module) => module.getWhatsAppConnection());
import styles from "./chat.module.css";
import type { PresenceAskView } from "./types";

const TIME_ZONE = "America/Sao_Paulo";
const hhmm = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const ease = [0.165, 0.84, 0.44, 1] as const;

type State =
  | { kind: "idle" }
  | { kind: "sending"; preview: string | null }
  | { kind: "waiting"; preview: string | null }
  | { kind: "done"; preview: string | null; at: string | null }
  | { kind: "error"; message: string }
  /** WhatsApp desconectado (regra de 06/11): o roteiro guiado de conexão está aberto (09/11). */
  | { kind: "whatsapp"; photo: Blob | null };

/** O roteiro guiado (09/11): conexão e, depois de conectar, a confirmação da presença dentro dele. */
type Guide = {
  connection: WhatsAppConnection;
  open: boolean;
  stage: ConfirmStage;
  photo: Blob | null;
  reconnect: boolean;
  error: string | null;
  confirmedAt: string | null;
  /** Muda quando o WhatsApp cai no meio: o diálogo recomeça do zero com o estado novo. */
  attempt: number;
};

type WhatsAppConnection = Awaited<ReturnType<typeof getWhatsAppConnection>>;
const WHATSAPP_REQUIRED_CODE = "whatsapp_required";

/** Phone photos are big: a 1600px JPEG is plenty to recognize the place and uploads fast. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * "Confirme sua presença": shown in highlight on the Início and in the Plantão
 * conversation. Online: one tap confirms. Presencial: the button opens the camera,
 * the photo goes to the director/manager and the broker stays paused until they
 * validate it and release him (decision of 2026-10-12).
 */
export function PresenceCallout({ ask, variant = "home" }: { ask: PresenceAskView; variant?: "home" | "chat" }) {
  const router = useRouter();
  // Kill-switch (html[data-interface-motion="off"]) também desliga, não só o movimento reduzido do sistema.
  const motionOn = useInterfaceMotionEnabled();
  const reduce = Boolean(useReducedMotion()) || !motionOn;
  const camera = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>(
    ask.status === "confirmed" ? { kind: "done", preview: null, at: null }
      : ask.status === "awaiting_release" ? { kind: "waiting", preview: ask.photoId ? `/api/duty/presence/photo?id=${ask.photoId}` : null }
        : { kind: "idle" },
  );
  const previewUrl = useRef<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  // Roteiro guiado aberto pela confirmação (09/11): conecta o WhatsApp e confirma a presença sem sair dele.
  const [whatsapp, setWhatsapp] = useState<Guide | null>(null);
  const guideKey = `${ask.assignmentId}:${ask.startsAt}`;
  // Parou no meio do roteiro (fechou, ou o celular recarregou a página): o botão diz que continua de onde parou.
  const [resumable, setResumable] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lembrança local, lida só no navegador
    setResumable(Boolean(readGuideMemory(guideKey)));
  }, [guideKey]);
  const [checking, setChecking] = useState(false);
  const presencial = ask.mode === "presencial";
  const [started] = useState(() => new Date(ask.startsAt).getTime() <= Date.now());

  // Waiting for the director: check every 30 s; once released, the card turns into "confirmada".
  useEffect(() => {
    if (state.kind !== "waiting") return;
    const timer = window.setInterval(() => router.refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [router, state.kind]);
  const released = ask.status === "confirmed";
  useEffect(() => {
    if (!released) return;
    // Adjusting to the server's answer after a refresh (the release happens on the manager's screen).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((current) => current.kind === "done" ? current : { kind: "done", preview: null, at: null });
  }, [released]);

  // Frees the local photo preview when the card goes away.
  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  async function send(photo: Blob | null, viaGuide = false) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    const preview = photo ? URL.createObjectURL(photo) : null;
    previewUrl.current = preview;
    setState({ kind: "sending", preview });
    if (viaGuide) setWhatsapp((current) => (current ? { ...current, stage: "sending", error: null } : current));
    const body = new FormData();
    body.set("assignmentId", ask.assignmentId);
    if (photo) body.set("photo", photo, "local.jpg");
    try {
      const response = await fetch("/api/duty/presence", { method: "POST", body });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; code?: string; awaitingRelease?: boolean };
      if (result.code === WHATSAPP_REQUIRED_CODE) {
        await openWhatsApp(photo, undefined, true);
        return;
      }
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Não consegui confirmar agora. Tente de novo.");
      const at = hhmm(new Date().toISOString());
      setState(result.awaitingRelease ? { kind: "waiting", preview } : { kind: "done", preview, at });
      if (viaGuide) setWhatsapp((current) => (current ? { ...current, stage: result.awaitingRelease ? "waiting" : "done", confirmedAt: at } : current));
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(30);
      // Pelo roteiro, a tela atualiza quando o corretor sai dele ("Ir para o Plantão").
      if (!viaGuide) window.setTimeout(() => router.refresh(), 1600);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não consegui confirmar agora. Tente de novo.";
      setState({ kind: "error", message });
      if (viaGuide) setWhatsapp((current) => (current ? { ...current, stage: "error", error: message } : current));
    }
  }

  /** Abre o roteiro guiado de conexão; ao conectar, ele segue para a confirmação (com a foto, se já tirada). */
  async function openWhatsApp(photo: Blob | null, known?: WhatsAppConnection, reconnect = false) {
    const connection = known ?? await loadWhatsAppConnection().catch(() => null);
    if (!connection) {
      setState({ kind: "error", message: "Conecte o seu WhatsApp para confirmar presença. Não consegui abrir a conexão agora; tente de novo." });
      return;
    }
    setState({ kind: "whatsapp", photo });
    setWhatsapp((current) => ({
      connection: reconnect ? { ...connection, status: "disconnected" } : connection,
      open: true,
      stage: "connect",
      photo,
      reconnect,
      error: null,
      confirmedAt: null,
      attempt: (current?.attempt ?? 0) + (reconnect ? 1 : 0),
    }));
  }

  /** Conectou: o roteiro mostra "Confirmar presença" (P7 do plano: um toque, não automático). */
  function continueAfterConnected() {
    setWhatsapp((current) => (current ? { ...current, stage: "confirm" } : current));
  }

  function confirmFromGuide() {
    const guide = whatsapp;
    if (!guide) return;
    // Presencial sem foto: o roteiro fecha e a câmera abre; o cartão segue como antes (foto → diretor libera).
    if (presencial && !guide.photo) {
      setWhatsapp(null);
      openCamera();
      return;
    }
    void send(guide.photo, true);
  }

  function finishGuide() {
    setWhatsapp(null);
    setResumable(false);
    router.refresh();
  }

  function openCamera() {
    // In-page camera first (the system camera app can make low-memory Androids close the browser).
    if (canUseInPageCamera()) setCameraOpen(true);
    else camera.current?.click();
  }

  async function start() {
    if (state.kind === "sending" || checking) return;
    if (state.kind === "whatsapp" && whatsapp) {
      setWhatsapp({ ...whatsapp, open: true });
      return;
    }
    // Regra de 06/11: sem WhatsApp conectado, abre a conexão antes (no presencial, antes da foto).
    setChecking(true);
    const gate = await loadPresenceGate().catch(() => null);
    setChecking(false);
    if (gate?.required && !gate.connected) {
      await openWhatsApp(null, gate.connection);
      return;
    }
    beginConfirm();
  }

  function beginConfirm() {
    if (presencial) openCamera();
    else void send(null);
  }

  const done = state.kind === "done";
  const waiting = state.kind === "waiting";
  const sending = state.kind === "sending";
  const needsWhatsApp = state.kind === "whatsapp";
  const preview = state.kind === "sending" || state.kind === "done" || state.kind === "waiting" ? state.preview : null;

  return (
    <motion.section
      className={styles.presence}
      data-variant={variant}
      data-done={done}
      aria-label="Confirmar presença no plantão"
      initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, ease }}
    >
      {!done && !reduce ? <span className={styles.presenceHalo} aria-hidden="true" /> : null}
      <div className={styles.presenceHead}>
        <span className={styles.presenceMascot}>
          <AssistantAvatar shape="onigiri" hue={28} size={44} state={sending || waiting ? "working" : done ? "idle" : "waiting"} />
        </span>
        <span className={styles.presenceText}>
          <span className={styles.presencePill} data-mode={ask.mode}>
            {presencial ? (
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 1 0-9 0C3.5 9.8 8 14 8 14Z" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="8" cy="6.5" r="1.6" fill="currentColor" /></svg>
            ) : <span className={styles.presenceLive} aria-hidden="true" />}
            {presencial ? "Plantão presencial" : "Plantão online"} · {started ? `até ${hhmm(ask.endsAt)}` : `começa ${hhmm(ask.startsAt)}`}
          </span>
          <span className={styles.presenceSchedule}>{ask.scheduleName}{ask.branchName ? ` · ${ask.branchName}` : ""}</span>
          <span className={styles.presenceTitle}>{done ? "Presença confirmada" : waiting ? "Foto enviada" : "Confirme sua presença"}</span>
          <span className={styles.presenceDetail}>
            {done
              ? ask.startInterval
                ? "Pronto. Enquanto seus colegas confirmam, você recebe um lead a cada 8 min."
                : "Pronto. Você já pode receber leads deste plantão."
              : waiting
                ? "Agora o diretor valida a foto e libera você. Até lá você fica pausado, sem receber leads."
              : presencial
                ? `${ask.scheduleName}${ask.branchName ? ` · ${ask.branchName}` : ""}. Plantão presencial: você precisa estar na unidade durante todo o plantão. Já na unidade, tire uma foto do local; o diretor valida e libera você.`
                : `${ask.scheduleName}. Um toque e você começa a receber leads.`}
          </span>
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {preview ? (
          <motion.div
            key="photo"
            className={styles.presencePhoto}
            initial={reduce ? false : { opacity: 0, scale: 0.92, rotate: -2 }}
            animate={{ opacity: 1, scale: 1, rotate: done ? 0 : -1.5 }}
            transition={{ type: "spring", visualDuration: 0.32, bounce: 0.3 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview or the private, auth-checked photo route */}
            <img src={preview} alt="Foto do local do plantão" />
            {sending ? <span className={styles.presenceScan} aria-hidden="true" /> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {state.kind === "error" ? <p className={styles.presenceError} role="alert">{state.message}</p> : null}
      {needsWhatsApp ? <p className={styles.presenceError} role="status">Falta conectar o seu WhatsApp. Toque abaixo e eu te guio passo a passo.</p> : null}

      {done ? (
        <motion.p
          className={styles.presenceDone}
          role="status"
          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", visualDuration: 0.32, bounce: 0.45 }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <motion.path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={reduce ? { duration: 0 } : { duration: 0.32, ease, delay: 0.1 }} />
          </svg>
          {state.at ? `Confirmado às ${state.at}` : "Confirmado"}
        </motion.p>
      ) : waiting ? (
        <div className={styles.presenceWaiting}>
          <p className={styles.presenceWaitingPill} role="status"><span className={styles.presenceClock} aria-hidden="true" />Aguardando o diretor liberar</p>
          <button type="button" className={styles.presenceRetake} onClick={() => { void start(); }}>Tirar outra foto</button>
        </div>
      ) : (
        <motion.button
          type="button"
          className={styles.presenceButton}
          onClick={() => { void start(); }}
          disabled={sending || checking}
          whileTap={reduce ? undefined : { scale: 0.97 }}
        >
          {sending ? <span className={styles.shimmerText} style={{ color: "inherit" }}>{presencial ? "Enviando a foto…" : "Confirmando…"}</span> : presencial ? (
            <>
              <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M2.5 5.5A1.5 1.5 0 0 1 4 4h1.4l1-1.5h3.2l1 1.5H12a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 12 13H4a1.5 1.5 0 0 1-1.5-1.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="8" cy="8.5" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
              {state.kind === "error" ? "Tirar outra foto" : "Tirar foto do local"}
            </>
          ) : needsWhatsApp || resumable ? "Continuar de onde parei" : state.kind === "error" ? "Tentar de novo" : "Confirmar presença"}
        </motion.button>
      )}

      {whatsapp ? (
        <WhatsAppConnectDialog
          key={whatsapp.attempt}
          initial={whatsapp.connection}
          open={whatsapp.open}
          variant="presence"
          triggerLabel="Conectar WhatsApp"
          duty={{ key: guideKey, scheduleName: ask.scheduleName, branchName: ask.branchName, mode: ask.mode, until: hhmm(ask.endsAt) }}
          presence={{
            stage: whatsapp.stage,
            error: whatsapp.error,
            confirmedAt: whatsapp.confirmedAt,
            reconnect: whatsapp.reconnect,
            onConfirm: confirmFromGuide,
            onFinish: finishGuide,
          }}
          onOpenChange={(open) => {
            // Fechou depois de confirmar: é o mesmo que "Ir para o Plantão".
            if (!open && (whatsapp.stage === "done" || whatsapp.stage === "waiting")) finishGuide();
            else {
              setWhatsapp((current) => (current ? { ...current, open } : current));
              if (!open) setResumable(true);
            }
          }}
          onReady={continueAfterConnected}
        />
      ) : null}

      {cameraOpen ? (
        <CameraCapture
          onShot={(photo) => { setCameraOpen(false); void send(photo); }}
          onClose={() => setCameraOpen(false)}
          onFallback={() => { setCameraOpen(false); camera.current?.click(); }}
        />
      ) : null}
      {presencial ? (
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          aria-hidden="true"
          tabIndex={-1}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void send(await shrink(file));
          }}
        />
      ) : null}
    </motion.section>
  );
}

/** Keeps one confirmation visually unchanged and groups overlapping duties when context matters. */
export function PresenceCalloutList({ asks, variant = "home" }: { asks: PresenceAskView[]; variant?: "home" | "chat" }) {
  // Two or more at once: the confirmed one stays as context while another still waits; all confirmed, nothing shows.
  const visibleAsks = asks.some((ask) => ask.status !== "confirmed") ? (asks.length > 1 ? asks : asks.filter((ask) => ask.status !== "confirmed")) : [];
  if (!visibleAsks.length) return null;
  if (visibleAsks.length === 1) return <PresenceCallout ask={visibleAsks[0]!} variant={variant} />;

  return (
    <section className={styles.presenceGroup} data-variant={variant} aria-label={`${visibleAsks.length} plantões agora`}>
      <h2 className={styles.presenceGroupTitle}>{visibleAsks.length} plantões agora</h2>
      <LiteList className={styles.presenceList} label="Presenças nos plantões">
        {visibleAsks.map((ask) => (
          <LiteListItem key={`${ask.assignmentId}:${ask.startsAt}`} className={styles.presenceItem}>
            <PresenceCallout ask={ask} variant="chat" />
          </LiteListItem>
        ))}
      </LiteList>
    </section>
  );
}

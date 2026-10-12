"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { AssistantAvatar } from "./assistant-avatar";
import styles from "./chat.module.css";
import type { PresenceAskView } from "./types";

const TIME_ZONE = "America/Sao_Paulo";
const hhmm = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const ease = [0.165, 0.84, 0.44, 1] as const;

type State = { kind: "idle" } | { kind: "sending"; preview: string | null } | { kind: "done"; preview: string | null; at: string | null } | { kind: "error"; message: string };

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
 * conversation. Online: one tap. Presencial: the button opens the camera and the
 * photo of the place confirms (and releases the broker) at once.
 */
export function PresenceCallout({ ask, variant = "home" }: { ask: PresenceAskView; variant?: "home" | "chat" }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const camera = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>(ask.status === "confirmed" ? { kind: "done", preview: null, at: null } : { kind: "idle" });
  const previewUrl = useRef<string | null>(null);
  const presencial = ask.mode === "presencial";
  const [started] = useState(() => new Date(ask.startsAt).getTime() <= Date.now());

  // Frees the local photo preview when the card goes away.
  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  async function send(photo: Blob | null) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    const preview = photo ? URL.createObjectURL(photo) : null;
    previewUrl.current = preview;
    setState({ kind: "sending", preview });
    const body = new FormData();
    body.set("assignmentId", ask.assignmentId);
    if (photo) body.set("photo", photo, "local.jpg");
    try {
      const response = await fetch("/api/duty/presence", { method: "POST", body });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Não consegui confirmar agora. Tente de novo.");
      setState({ kind: "done", preview, at: hhmm(new Date().toISOString()) });
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(30);
      window.setTimeout(() => router.refresh(), 1600);
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Não consegui confirmar agora. Tente de novo." });
    }
  }

  function start() {
    if (state.kind === "sending") return;
    if (presencial) camera.current?.click();
    else void send(null);
  }

  const done = state.kind === "done";
  const sending = state.kind === "sending";
  const preview = state.kind === "sending" || state.kind === "done" ? state.preview : null;

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
          <AssistantAvatar shape="onigiri" hue={28} size={44} state={sending ? "working" : done ? "idle" : "waiting"} />
        </span>
        <span className={styles.presenceText}>
          <span className={styles.presencePill} data-mode={ask.mode}>
            {presencial ? (
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 1 0-9 0C3.5 9.8 8 14 8 14Z" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="8" cy="6.5" r="1.6" fill="currentColor" /></svg>
            ) : <span className={styles.presenceLive} aria-hidden="true" />}
            {presencial ? "Plantão presencial" : "Plantão online"} · {started ? `até ${hhmm(ask.endsAt)}` : `começa ${hhmm(ask.startsAt)}`}
          </span>
          <span className={styles.presenceTitle}>{done ? "Presença confirmada" : "Confirme sua presença"}</span>
          <span className={styles.presenceDetail}>
            {done
              ? "Pronto. Você já pode receber leads deste plantão."
              : presencial
                ? `${ask.scheduleName}${ask.branchName ? ` · ${ask.branchName}` : ""}. Plantão presencial: você precisa estar na unidade durante todo o plantão. Já na unidade, tire uma foto do local para confirmar.`
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
            transition={{ type: "spring", visualDuration: 0.45, bounce: 0.3 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img src={preview} alt="Foto do local do plantão" />
            {sending ? <span className={styles.presenceScan} aria-hidden="true" /> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {state.kind === "error" ? <p className={styles.presenceError} role="alert">{state.message}</p> : null}

      {done ? (
        <motion.p
          className={styles.presenceDone}
          role="status"
          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", visualDuration: 0.4, bounce: 0.45 }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <motion.path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, ease, delay: 0.1 }} />
          </svg>
          {state.at ? `Confirmado às ${state.at}` : "Confirmado"}
        </motion.p>
      ) : (
        <motion.button
          type="button"
          className={styles.presenceButton}
          onClick={start}
          disabled={sending}
          whileTap={reduce ? undefined : { scale: 0.97 }}
        >
          {sending ? <span className={styles.shimmerText} style={{ color: "inherit" }}>{presencial ? "Enviando a foto…" : "Confirmando…"}</span> : presencial ? (
            <>
              <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M2.5 5.5A1.5 1.5 0 0 1 4 4h1.4l1-1.5h3.2l1 1.5H12a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 12 13H4a1.5 1.5 0 0 1-1.5-1.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="8" cy="8.5" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
              {state.kind === "error" ? "Tirar outra foto" : "Tirar foto do local"}
            </>
          ) : state.kind === "error" ? "Tentar de novo" : "Confirmar presença"}
        </motion.button>
      )}

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

"use client";

/**
 * Gravação de voz da Sasá (fase 2, 19/11/2026): segurar grava, soltar envia, arrastar para a esquerda cancela.
 * O áudio fica só na memória do navegador até virar texto no servidor (D4: nunca é guardado).
 * Plano: docs/implementations/active/2026-11-19-sasa-agentica.md §3.2 e §4.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { stopVoice } from "@/lib/feedback/voice-playback";

export const VOICE_MAX_SECONDS = 60;
/** Toque mais curto que isso não é fala: vira a dica "Segure para falar". */
export const VOICE_MIN_MS = 450;
/** Quanto arrastar para a esquerda para cancelar. */
export const VOICE_CANCEL_PX = 64;

export type VoiceTranscribe = (input: { audio: Blob; seconds: number; clientCommandId: string }) => Promise<{ ok: true; text: string } | { ok: false; error: string }>;

export type VoiceState =
  | { kind: "idle" }
  | { kind: "recording"; startedAt: number; cancelling: boolean }
  | { kind: "sending" };

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export function pickVoiceMimeType(isSupported: (type: string) => boolean): string | undefined {
  return MIME_TYPES.find((type) => isSupported(type));
}

export function voiceSupported() {
  return typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function useVoiceRecorder(input: { onAudio: (audio: Blob, seconds: number) => void; onError: (message: string) => void; /** Laboratório sem microfone: grava de mentira, com o mesmo gesto e os mesmos estados. */ simulate?: boolean }) {
  const [state, setState] = useState<VoiceState>({ kind: "idle" });
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const cancelled = useRef(false);
  const timer = useRef<number | null>(null);
  const callbacks = useRef(input);
  callbacks.current = input;

  const release = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    recorder.current = null;
  }, []);

  useEffect(() => () => { cancelled.current = true; recorder.current?.state === "recording" && recorder.current.stop(); release(); }, [release]);

  const simulating = useRef(false);
  const stop = useCallback((cancel: boolean) => {
    if (simulating.current) {
      simulating.current = false;
      if (timer.current) window.clearTimeout(timer.current);
      const elapsed = Date.now() - startedAt.current;
      if (cancel) { setState({ kind: "idle" }); return; }
      if (elapsed < VOICE_MIN_MS) { setState({ kind: "idle" }); callbacks.current.onError("Segure o microfone enquanto fala."); return; }
      setState({ kind: "sending" });
      callbacks.current.onAudio(new Blob(["lab"], { type: "audio/webm" }), Math.min(VOICE_MAX_SECONDS, elapsed / 1000));
      return;
    }
    if (recorder.current?.state === "recording") {
      cancelled.current = cancel;
      recorder.current.stop();
      return;
    }
    // Soltou antes de o microfone abrir: o start que ainda está esperando vê o cancelamento e para.
    cancelled.current = true;
    release();
    setState({ kind: "idle" });
    if (!cancel) callbacks.current.onError("Segure o microfone enquanto fala.");
  }, [release]);

  const start = useCallback(async () => {
    // Voz da Sasá (23/11): segurou para falar, ela para de falar na hora.
    stopVoice();
    if (callbacks.current.simulate) {
      simulating.current = true;
      startedAt.current = Date.now();
      setState({ kind: "recording", startedAt: startedAt.current, cancelling: false });
      timer.current = window.setTimeout(() => stop(false), VOICE_MAX_SECONDS * 1000);
      return;
    }
    if (recorder.current || !voiceSupported()) {
      if (!voiceSupported()) callbacks.current.onError("Este navegador não grava áudio. Escreva para a Sasá.");
      return;
    }
    cancelled.current = false;
    startedAt.current = Date.now();
    setState({ kind: "recording", startedAt: startedAt.current, cancelling: false });
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Soltou antes de o microfone abrir: nada a gravar.
      if (cancelled.current) { media.getTracks().forEach((track) => track.stop()); setState({ kind: "idle" }); return; }
      stream.current = media;
      const mimeType = pickVoiceMimeType((type) => MediaRecorder.isTypeSupported(type));
      const next = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      next.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      next.onstop = () => {
        const elapsed = Date.now() - startedAt.current;
        const audio = new Blob(chunks.current, { type: next.mimeType || mimeType || "audio/webm" });
        chunks.current = [];
        release();
        if (cancelled.current) { setState({ kind: "idle" }); return; }
        if (elapsed < VOICE_MIN_MS || !audio.size) { setState({ kind: "idle" }); callbacks.current.onError("Segure o microfone enquanto fala."); return; }
        setState({ kind: "sending" });
        callbacks.current.onAudio(audio, Math.min(VOICE_MAX_SECONDS, elapsed / 1000));
      };
      recorder.current = next;
      next.start();
      timer.current = window.setTimeout(() => stop(false), VOICE_MAX_SECONDS * 1000);
    } catch {
      release();
      setState({ kind: "idle" });
      callbacks.current.onError("Libere o microfone nas configurações do navegador para falar com a Sasá.");
    }
  }, [release, stop]);

  const setCancelling = useCallback((cancelling: boolean) => {
    setState((current) => (current.kind === "recording" && current.cancelling !== cancelling ? { ...current, cancelling } : current));
  }, []);

  const done = useCallback(() => setState({ kind: "idle" }), []);

  return { state, start, stop, setCancelling, done };
}

/** "0:07": o tempo da gravação. */
export function voiceClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

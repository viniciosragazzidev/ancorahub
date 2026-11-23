"use client";

import Link from "next/link";
import { Settings2, Volume2, VolumeX } from "lucide-react";

import { useFeedback } from "@/lib/feedback/use-feedback";

import { useSasaVoice } from "../client";
import styles from "./sasa-voice.module.css";

export const SASA_VOICE_SETTINGS_HREF = "/settings?tab=voz-sasa";

/**
 * Topo da conversa da Sasá, só para quem testa a voz (23/11): o interruptor da voz e o atalho para conectar a key.
 * Ligar e desligar é nível 1 (toque), sem som de celebração.
 */
export function SasaVoiceHeader({ settingsHref = SASA_VOICE_SETTINGS_HREF }: { settingsHref?: string }) {
  const voice = useSasaVoice({ load: true });
  const fire = useFeedback();
  const state = voice.state;
  if (!state?.allowed) return null;
  if (!state.connected) {
    return (
      <Link href={settingsHref} className={styles.iconButton} aria-label="Conectar a voz da Sasá">
        <VolumeX aria-hidden="true" />
      </Link>
    );
  }
  return (
    <div className={styles.headerControls}>
      <button
        type="button"
        className={styles.iconButton}
        aria-pressed={state.enabled}
        aria-label={state.enabled ? "Voz da Sasá ligada. Tocar para desligar" : "Voz da Sasá desligada. Tocar para ligar"}
        onClick={async () => {
          fire("tap");
          const result = await voice.toggle(!state.enabled);
          if (!result.ok) fire("error");
        }}
      >
        {state.enabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
      </button>
      <Link href={settingsHref} className={styles.iconButton} aria-label="Configurar a voz da Sasá">
        <Settings2 aria-hidden="true" />
      </Link>
    </div>
  );
}

/** Aviso fixo da conversa: "Sasá falando" com Parar, ou por que ficou só no texto. */
export function SasaVoiceNotice() {
  const voice = useSasaVoice();
  if (!voice.state?.allowed) return null;
  if (voice.phase === "playing" || voice.phase === "loading") {
    return (
      <div className={styles.notice} role="status">
        <span className={styles.noticeText}>{voice.phase === "loading" ? "Preparando a voz…" : "Sasá falando…"}</span>
        <button type="button" className={styles.noticeAction} onClick={voice.stop}>Parar</button>
      </div>
    );
  }
  if ((voice.phase === "failed" || voice.phase === "muted") && voice.reason) {
    return <div className={styles.notice} role="status"><span className={styles.noticeText}>Só texto: {voice.reason}.</span></div>;
  }
  return null;
}

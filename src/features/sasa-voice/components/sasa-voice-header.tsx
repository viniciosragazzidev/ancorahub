"use client";

import { Volume2, VolumeX } from "lucide-react";

import { useFeedback } from "@/lib/feedback/use-feedback";

import { useSasaVoice } from "../client";
import styles from "./sasa-voice.module.css";

/** Onde o diretor conecta a key (Configurações do diretor no Lite). */
export const SASA_VOICE_SETTINGS_HREF = "/settings?tab=voz-sasa";

/**
 * Topo da conversa do Sasá, só para o corretor do teste (23/11): liga e desliga a voz para ele. A key é da empresa e
 * quem conecta é o diretor; sem ela, ou com a voz desligada pelo diretor, o botão nem aparece.
 * Ligar e desligar é nível 1 (toque), sem som de celebração.
 */
export function SasaVoiceHeader() {
  const voice = useSasaVoice({ load: true });
  const fire = useFeedback();
  const state = voice.state;
  if (!state?.allowed || !state.connected || !state.companyEnabled) return null;
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-pressed={state.enabled}
      aria-label={state.enabled ? "Voz do Sasá ligada. Tocar para desligar" : "Voz do Sasá desligada. Tocar para ligar"}
      onClick={async () => {
        fire("tap");
        const result = await voice.toggle(!state.enabled);
        if (!result.ok) fire("error");
      }}
    >
      {state.enabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
    </button>
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

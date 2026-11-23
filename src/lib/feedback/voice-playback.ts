"use client";

/**
 * Fala do Sasá (voz por ElevenLabs, teste de 23/11). Mora junto do `useFeedback` porque é som: respeita a mesma
 * preferência "Som" das configurações de acessibilidade (o mudo do app). Um áudio por vez;
 * `stopVoice` corta na hora (o corretor segurou o botão para falar de novo).
 */
import { readA11yPrefs } from "@/features/assist/a11y-prefs";

let current: { audio: HTMLAudioElement; url: string } | null = null;

/** O som do app está ligado para esta pessoa? */
export function voicePlaybackAllowed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return readA11yPrefs().sound !== false;
  } catch {
    return true;
  }
}

/** Sobe a cada corte: um áudio que ainda estava a caminho não toca depois de "pare". */
let epoch = 0;
export function voiceEpoch() {
  return epoch;
}

function halt() {
  if (!current) return;
  const { audio, url } = current;
  current = null;
  try { audio.pause(); } catch { /* já parado */ }
  URL.revokeObjectURL(url);
  audio.dispatchEvent(new Event("ended"));
}

/** Corta a fala na hora e cancela a que ainda vinha. */
export function stopVoice() {
  epoch += 1;
  halt();
}

export function isVoicePlaying() {
  return Boolean(current);
}

/**
 * Toca o áudio. Devolve uma promessa que termina quando a fala acaba ou é cortada; `false` se o navegador não
 * deixou tocar (sem toque na página, por exemplo) ou se o som está desligado.
 */
export async function playVoice(blob: Blob, expectedEpoch?: number): Promise<boolean> {
  if (!voicePlaybackAllowed()) return false;
  if (expectedEpoch !== undefined && expectedEpoch !== epoch) return false;
  halt();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  current = { audio, url };
  const finished = new Promise<void>((resolve) => {
    const done = () => {
      if (current?.audio === audio) { current = null; URL.revokeObjectURL(url); }
      resolve();
    };
    audio.addEventListener("ended", done, { once: true });
    audio.addEventListener("error", done, { once: true });
  });
  try {
    await audio.play();
  } catch {
    if (current?.audio === audio) { current = null; URL.revokeObjectURL(url); }
    return false;
  }
  await finished;
  return true;
}

"use client";

/**
 * Voz do Sasá no aparelho (teste de 23/11). Um estado só para a conversa, o botão flutuante e a tela de conexão:
 * o Sasá responde em texto primeiro; depois, se a voz está ligada, o servidor gera o áudio e ele toca.
 * Se o ElevenLabs falhar, fica só o texto, com o motivo curto. O laboratório troca o servidor por um simulado.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";

import type { ChatBlock } from "@/components/chat/types";
import { playVoice, stopVoice, voiceEpoch, voicePlaybackAllowed } from "@/lib/feedback/voice-playback";
import { useDevLab } from "@/lib/dev-lab";

import { chooseSasaVoiceAction, connectSasaVoiceAction, disconnectSasaVoiceAction, getSasaVoiceStateAction, listSasaVoicesAction, setSasaVoiceEnabledAction } from "./actions";
import { sasaVoiceText, type SasaVoiceOption, type SasaVoiceState } from "./rules";

export type SasaVoiceResult = { ok: true; state: SasaVoiceState } | { ok: false; error: string };
export type SasaVoiceListResult = { ok: true; state: SasaVoiceState; voices: SasaVoiceOption[] } | { ok: false; error: string };
export type SasaVoiceSpeech = { ok: true; audio: Blob } | { ok: false; reason: string };

/** O servidor da voz: real (ações + /api/sasa/fala) ou simulado no laboratório. */
export type SasaVoiceBackend = {
  state: () => Promise<SasaVoiceState>;
  connect: (apiKey: string) => Promise<SasaVoiceListResult>;
  voices: () => Promise<SasaVoiceListResult>;
  choose: (voice: { voiceId: string; voiceName: string }) => Promise<SasaVoiceResult>;
  setEnabled: (enabled: boolean) => Promise<SasaVoiceResult>;
  disconnect: () => Promise<SasaVoiceResult>;
  speak: (input: { text?: string; test?: boolean }) => Promise<SasaVoiceSpeech>;
};

export const serverVoiceBackend: SasaVoiceBackend = {
  state: getSasaVoiceStateAction,
  connect: connectSasaVoiceAction,
  voices: listSasaVoicesAction,
  choose: chooseSasaVoiceAction,
  setEnabled: setSasaVoiceEnabledAction,
  disconnect: disconnectSasaVoiceAction,
  speak: async (input) => {
    try {
      const response = await fetch("/api/sasa/fala", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { reason?: string } | null;
        return { ok: false, reason: data?.reason ?? "não consegui gerar a voz" };
      }
      return { ok: true, audio: await response.blob() };
    } catch {
      return { ok: false, reason: "sem conexão com o servidor" };
    }
  },
};

export type SasaVoicePhase = "idle" | "loading" | "playing" | "failed" | "muted";
export type SasaVoiceSnapshot = { state: SasaVoiceState | null; phase: SasaVoicePhase; reason: string | null };

let snapshot: SasaVoiceSnapshot = { state: null, phase: "idle", reason: null };
let loading: Promise<SasaVoiceState> | null = null;
const listeners = new Set<() => void>();

function set(next: Partial<SasaVoiceSnapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Lê o estado uma vez por visita (quem não está no teste recebe tudo desligado e nada mais é pedido). */
export function loadSasaVoice(backend: SasaVoiceBackend, force = false): Promise<SasaVoiceState> {
  if (snapshot.state && !force) return Promise.resolve(snapshot.state);
  if (!loading || force) {
    loading = backend.state().then((state) => { set({ state }); return state; }).finally(() => { loading = null; });
  }
  return loading;
}

export function setSasaVoiceState(state: SasaVoiceState) {
  set({ state });
}

/** Para a fala na hora (segurou para falar de novo, desligou a voz, saiu da conversa). */
export function stopSasaVoice() {
  stopVoice();
  if (snapshot.phase === "loading" || snapshot.phase === "playing") set({ phase: "idle", reason: null });
}

/**
 * Fala a resposta da Sasá. Nunca segura o texto: é chamada depois que os blocos já estão na tela.
 * Devolve o motivo quando ficou só no texto (para o aviso curto).
 */
export async function speakSasaReply(backend: SasaVoiceBackend, blocks: readonly ChatBlock[]): Promise<{ spoke: boolean; reason: string | null }> {
  const state = snapshot.state ?? await loadSasaVoice(backend).catch(() => null);
  if (!state?.connected || !state.enabled) return { spoke: false, reason: null };
  const text = sasaVoiceText(blocks);
  if (!text) return { spoke: false, reason: null };
  if (!voicePlaybackAllowed()) {
    set({ phase: "muted", reason: "o som do app está desligado" });
    return { spoke: false, reason: "o som do app está desligado" };
  }
  const epoch = voiceEpoch() + 1;
  stopVoice();
  set({ phase: "loading", reason: null });
  const speech = await backend.speak({ text });
  // Segurou para falar (ou desligou) enquanto o áudio vinha: não toca mais.
  if (voiceEpoch() !== epoch) {
    if (snapshot.phase === "loading") set({ phase: "idle" });
    return { spoke: false, reason: null };
  }
  if (!speech.ok) {
    set({ phase: "failed", reason: speech.reason });
    return { spoke: false, reason: speech.reason };
  }
  set({ phase: "playing", reason: null, state: { ...state, usedToday: state.usedToday + text.length } });
  const played = await playVoice(speech.audio, epoch);
  if (voiceEpoch() !== epoch && !played) return { spoke: false, reason: null };
  if (!played) {
    set({ phase: "failed", reason: "o navegador não deixou tocar o áudio" });
    return { spoke: false, reason: "o navegador não deixou tocar o áudio" };
  }
  if (snapshot.phase === "playing") set({ phase: "idle" });
  return { spoke: true, reason: null };
}

/** Só para testes: volta ao começo. */
export function resetSasaVoiceForTests() {
  snapshot = { state: null, phase: "idle", reason: null };
  loading = null;
}

export function useSasaVoiceBackend(): SasaVoiceBackend {
  const lab = useDevLab();
  return lab?.sasa?.voice ?? serverVoiceBackend;
}

/**
 * A voz na tela. `load` lê o estado ao montar (só onde a página já sabe que é o corretor do teste);
 * sem ele, o estado é lido na primeira resposta.
 */
export function useSasaVoice(options: { load?: boolean } = {}) {
  const backend = useSasaVoiceBackend();
  const current = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  useEffect(() => {
    if (options.load) void loadSasaVoice(backend).catch(() => undefined);
  }, [backend, options.load]);
  const speak = useCallback((blocks: readonly ChatBlock[]) => speakSasaReply(backend, blocks), [backend]);
  const toggle = useCallback(async (enabled: boolean): Promise<SasaVoiceResult> => {
    if (!enabled) stopSasaVoice();
    const result = await backend.setEnabled(enabled);
    if (result.ok) set({ state: result.state, phase: "idle", reason: null });
    return result;
  }, [backend]);
  return { ...current, backend, speak, toggle, stop: stopSasaVoice };
}

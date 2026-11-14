"use client";

/**
 * Vaga do mascote numa área do app (mascot-placements.ts). Desligada, não desenha nada e a área fica
 * como era. Ligada, mostra o <Mascot> com o estado e o tamanho da vaga.
 */
import { useSyncExternalStore } from "react";

import { Mascot } from "./mascot";
import type { MascotState } from "./mascot-config";
import { MASCOT_PLACEMENTS, MASCOT_PREVIEW_ALL_KEY, type MascotPlacement, type MascotPlacementConfig } from "./mascot-placements";

const PREVIEW_EVENT = "ancora:mascote-vagas";

function subscribe(onChange: () => void) {
  window.addEventListener(PREVIEW_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PREVIEW_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readPreviewAll() {
  if (process.env.NODE_ENV !== "development") return false;
  try { return window.localStorage.getItem(MASCOT_PREVIEW_ALL_KEY) === "1"; } catch { return false; }
}

/** Liga ou desliga "Mostrar todas as vagas" (só tem efeito em desenvolvimento). */
export function setMascotPreviewAll(on: boolean) {
  try {
    if (on) window.localStorage.setItem(MASCOT_PREVIEW_ALL_KEY, "1");
    else window.localStorage.removeItem(MASCOT_PREVIEW_ALL_KEY);
  } catch { /* sem storage */ }
  window.dispatchEvent(new Event(PREVIEW_EVENT));
}

export function useMascotPreviewAll() {
  return useSyncExternalStore(subscribe, readPreviewAll, () => false);
}

/** A configuração da vaga se ela estiver ligada (ou na prévia de todas as vagas); senão, null. */
export function useMascotPlacement(placement: MascotPlacement): MascotPlacementConfig | null {
  const previewAll = useMascotPreviewAll();
  const config = MASCOT_PLACEMENTS[placement];
  return config.enabled || previewAll ? config : null;
}

export function MascotSlot({ placement, state, size, className, decorative = true }: { placement: MascotPlacement; state?: MascotState; size?: number; className?: string; decorative?: boolean }) {
  const config = useMascotPlacement(placement);
  if (!config) return null;
  return <Mascot state={state ?? config.state} size={size ?? config.size} decorative={decorative} className={className} />;
}

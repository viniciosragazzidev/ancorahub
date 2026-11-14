"use client";

import { useEffect, useState } from "react";


/**
 * Aceite com contador (11/11). O aceite acontece num botão (Início, lista, chat) e o contador roda
 * na tela do lead: o link do WhatsApp passa pelo sessionStorage desta aba, válido por 2 minutos.
 */
const PREFIX = "lite:whatsapp-handoff:";
const TTL_MS = 2 * 60_000;

/** "counting": o quadro conta 30 s (computador). "failed": o celular não abriu o app no toque; a tela pede outro toque. */
export type WhatsAppHandoffPhase = "counting" | "failed";

export function rememberWhatsAppHandoff(leadId: string, whatsappUrl: string | null, phase: WhatsAppHandoffPhase = "counting") {
  try {
    window.sessionStorage.setItem(PREFIX + leadId, JSON.stringify({ url: whatsappUrl, at: Date.now(), phase }));
  } catch {
    /* modo privado ou armazenamento bloqueado: a tela do lead abre sem contador */
  }
}

/** Lê e apaga: recarregar a página não repete o contador. */
export function takeWhatsAppHandoff(leadId: string): { url: string | null; phase: WhatsAppHandoffPhase } | null {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + leadId);
    if (!raw) return null;
    window.sessionStorage.removeItem(PREFIX + leadId);
    const parsed = JSON.parse(raw) as { url?: unknown; at?: unknown; phase?: unknown };
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > TTL_MS) return null;
    return { url: typeof parsed.url === "string" ? parsed.url : null, phase: parsed.phase === "failed" ? "failed" : "counting" };
  } catch {
    return null;
  }
}

const OPEN_FAILED_EVENT = "lite:whatsapp-open-failed";

/**
 * Celular (14/11): o aceite manda direto para o WhatsApp no próprio toque, sem contador. Se o app não
 * abriu (a página continuou visível), avisa a tela do lead, que mostra "Toque para abrir o WhatsApp".
 * Guarda também no sessionStorage, para o caso de a tela do lead montar depois do aviso.
 */
export function reportWhatsAppOpenFailed(leadId: string, whatsappUrl: string) {
  rememberWhatsAppHandoff(leadId, whatsappUrl, "failed");
  try {
    window.dispatchEvent(new CustomEvent(OPEN_FAILED_EVENT, { detail: { leadId, url: whatsappUrl } }));
  } catch {
    /* sem CustomEvent: fica só o sessionStorage */
  }
}

/** A tela do lead escuta o aviso de "não abriu" deste lead; consome o registro para não repetir. */
export function onWhatsAppOpenFailed(leadId: string, listener: (url: string) => void) {
  const handle = (event: Event) => {
    const detail = (event as CustomEvent<{ leadId?: string; url?: string }>).detail;
    if (!detail || detail.leadId !== leadId || !detail.url) return;
    takeWhatsAppHandoff(leadId);
    listener(detail.url);
  };
  window.addEventListener(OPEN_FAILED_EVENT, handle);
  return () => window.removeEventListener(OPEN_FAILED_EVENT, handle);
}

let enabledPromise: Promise<boolean> | null = null;
let enabledValue: boolean | null = null;

/** Uma pergunta ao servidor por carga de página. Até responder (ou com erro): desligado, como hoje. */
export function useAcceptHandoffEnabled() {
  const [enabled, setEnabled] = useState<boolean>(enabledValue ?? false);
  useEffect(() => {
    if (enabledValue !== null) return;
    let alive = true;
    // Import tardio: os botões de aceite não carregam a action à toa (e os testes deles não a resolvem).
    enabledPromise ??= import("./actions").then((module) => module.getAcceptHandoffEnabledAction()).catch(() => false);
    void enabledPromise.then((value) => {
      enabledValue = value;
      if (alive) setEnabled(value);
    });
    return () => { alive = false; };
  }, []);
  return enabled;
}

export function resetAcceptHandoffFlagForTests(value: boolean | null = null) {
  enabledValue = value;
  enabledPromise = null;
}

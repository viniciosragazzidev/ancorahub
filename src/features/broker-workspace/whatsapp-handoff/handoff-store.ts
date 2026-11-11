"use client";

import { useEffect, useState } from "react";


/**
 * Aceite com contador (11/11). O aceite acontece num botão (Início, lista, chat) e o contador roda
 * na tela do lead: o link do WhatsApp passa pelo sessionStorage desta aba, válido por 2 minutos.
 */
const PREFIX = "lite:whatsapp-handoff:";
const TTL_MS = 2 * 60_000;

export function rememberWhatsAppHandoff(leadId: string, whatsappUrl: string | null) {
  try {
    window.sessionStorage.setItem(PREFIX + leadId, JSON.stringify({ url: whatsappUrl, at: Date.now() }));
  } catch {
    /* modo privado ou armazenamento bloqueado: a tela do lead abre sem contador */
  }
}

/** Lê e apaga: recarregar a página não repete o contador. */
export function takeWhatsAppHandoff(leadId: string): { url: string | null } | null {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + leadId);
    if (!raw) return null;
    window.sessionStorage.removeItem(PREFIX + leadId);
    const parsed = JSON.parse(raw) as { url?: unknown; at?: unknown };
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > TTL_MS) return null;
    return { url: typeof parsed.url === "string" ? parsed.url : null };
  } catch {
    return null;
  }
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

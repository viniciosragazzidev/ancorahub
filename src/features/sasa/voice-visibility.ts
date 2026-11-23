"use client";

/**
 * Onde o botão do Sasá aparece (fase 3, plano §4.1). Usa os mesmos sinais que o app já tem para "não cobrir
 * nada importante": `data-lead-offer` (oferta de lead com contador), `data-lite-moment` (celebração) e diálogos
 * abertos, como o anfitrião de conquistas. Qualquer superfície pode pedir para escondê-lo com `data-sasa-hide`,
 * e as pílulas flutuantes do pé da tela o empurram para cima com `data-sasa-lift`.
 */
import { useEffect, useState } from "react";

export type SasaVoiceHiddenReason = "route" | "offer" | "celebration" | "dialog" | "typing";

/** Conversas (têm o próprio microfone), registro de venda e cotação (fluxos guiados de tela cheia). */
export function sasaVoiceRouteHidden(pathname: string, chat: boolean) {
  if (chat) return true;
  return /^\/(dashboard\/c(\/|$)|cotacao(\/|$)|leads\/[^/]+\/registrar-venda(\/|$)|login|primeiro-acesso)/.test(pathname);
}

const DIALOG_SELECTOR = '[role="dialog"]:not([data-state="closed"]):not([data-sasa-own]), [role="alertdialog"], [data-sasa-hide]';

function visible(element: Element) {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== "hidden";
}

/** Lê a tela agora: o que esconde o botão (ou null) e se há uma pílula no pé para desviar. */
export function readSasaVoiceSurface(doc: Document): { hidden: Exclude<SasaVoiceHiddenReason, "route"> | null; lifted: boolean } {
  const root = doc.documentElement;
  const active = doc.activeElement;
  const typing = Boolean(active && !active.closest("[data-sasa-own]") && (active.matches("input:not([type=checkbox]):not([type=radio]):not([type=button]), textarea, select") || (active as HTMLElement).isContentEditable));
  const hidden = root.dataset.leadOffer === "1" ? "offer"
    : root.dataset.liteMoment ? "celebration"
      : Array.from(doc.querySelectorAll(DIALOG_SELECTOR)).some(visible) ? "dialog"
        : typing ? "typing"
          : null;
  const lifted = Array.from(doc.querySelectorAll("[data-sasa-lift]")).some((element) => Array.from(element.children).some(visible));
  return { hidden, lifted };
}

/** Acompanha a tela: atributos do <html>, diálogos que abrem e fecham, foco em campos de texto. */
export function useSasaVoiceSurface() {
  const [surface, setSurface] = useState<{ hidden: ReturnType<typeof readSasaVoiceSurface>["hidden"]; lifted: boolean }>({ hidden: null, lifted: false });
  useEffect(() => {
    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = readSasaVoiceSurface(document);
        setSurface((current) => (current.hidden === next.hidden && current.lifted === next.lifted ? current : next));
      });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-lead-offer", "data-lite-moment"] });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state", "data-sasa-hide", "data-sasa-lift", "role", "hidden"] });
    document.addEventListener("focusin", read);
    document.addEventListener("focusout", read);
    window.addEventListener("resize", read);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("focusin", read);
      document.removeEventListener("focusout", read);
      window.removeEventListener("resize", read);
    };
  }, []);
  return surface;
}

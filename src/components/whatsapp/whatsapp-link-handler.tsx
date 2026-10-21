"use client";

import { useEffect } from "react";

import { openWhatsApp } from "@/lib/whatsapp-open";
import { parseWhatsAppUrl } from "@/lib/whatsapp-url";

/**
 * One place for every WhatsApp link of the app (Vinicios, 2026-10-21): a click
 * on any wa.me / api.whatsapp.com / web.whatsapp.com/send link opens WhatsApp
 * Web directly on the computer (same "whatsapp_web" tab) and the app on the
 * phone, never the "abrir no WhatsApp" page. Handlers that already took the
 * click (preventDefault, e.g. a dialog) and Ctrl/Cmd clicks are left alone.
 */
export function WhatsAppLinkHandler() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.getAttribute("href");
      if (!parseWhatsAppUrl(href)) return;
      event.preventDefault();
      openWhatsApp(href!);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}

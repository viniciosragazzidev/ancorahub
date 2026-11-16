"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { REALTIME_SYNC_BROWSER_EVENT, type RealtimeSyncBrowserDetail } from "@/components/providers/realtime-events";

// 60 s (egress 16/11): plantão and presence edits send no signal, so this stays the fallback.
const POLL_MS = 60_000;
const SIGNAL_DEBOUNCE_MS = 2_000;

/** Conversation signals (a director gets one every ~10 s) never change the rotation: skip them (egress 16/11). */
export function isRotationSignal(detail: RealtimeSyncBrowserDetail | undefined) {
  return detail?.kind === "domain.invalidated" && detail.domain !== "conversations";
}

/**
 * Keeps the plantão page following the rotation (29/10): refreshes when a lead or offer changes
 * (realtime signal, 2 s debounce) and every 60 s while visible, so the cards slide to the new turn.
 */
export function DutyTurnAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => router.refresh();
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, POLL_MS);
    let timer: number | null = null;
    const onRealtime = (event: Event) => {
      const detail = (event as CustomEvent<RealtimeSyncBrowserDetail>).detail;
      if (!isRotationSignal(detail)) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => { timer = null; refresh(); }, SIGNAL_DEBOUNCE_MS);
    };
    window.addEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtime);
    return () => {
      window.clearInterval(interval);
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtime);
    };
  }, [router]);
  return null;
}

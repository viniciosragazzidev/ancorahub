"use client";

import { useEffect } from "react";

const LEADS_REVISION_KEY = "ancorahub:leads-revision";
const FRESH_EVENT_WINDOW_MS = 10 * 60 * 1000;

/**
 * A route navigation already receives a fresh RSC payload. Triggering a second
 * refresh after mount made /leads display its loading state twice. Consume the
 * local revision here; live updates while the page is open are coordinated by
 * RealtimeSyncProvider.
 */
export function LeadsLiveSync() {
  useEffect(() => {
    const revision = Number(window.sessionStorage.getItem(LEADS_REVISION_KEY) ?? 0);
    if (!Number.isFinite(revision) || Date.now() - revision > FRESH_EVENT_WINDOW_MS) return;
    window.sessionStorage.removeItem(LEADS_REVISION_KEY);
  }, []);

  return null;
}

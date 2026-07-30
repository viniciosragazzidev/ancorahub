"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const LEADS_REVISION_KEY = "ancorahub:leads-revision";
const FRESH_EVENT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Refreshes a server-rendered queue when the user enters it shortly after a
 * live assignment received on another route. The revision originates only
 * from the authenticated Realtime provider.
 */
export function LeadsLiveSync() {
  const router = useRouter();
  const refreshedRef = useRef(false);

  useEffect(() => {
    if (refreshedRef.current) return;

    const revision = Number(window.sessionStorage.getItem(LEADS_REVISION_KEY) ?? 0);
    if (!Number.isFinite(revision) || Date.now() - revision > FRESH_EVENT_WINDOW_MS) return;

    refreshedRef.current = true;
    router.refresh();
  }, [router]);

  return null;
}

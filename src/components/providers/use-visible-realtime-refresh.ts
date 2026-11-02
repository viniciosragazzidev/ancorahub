"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { REALTIME_SYNC_BROWSER_EVENT, type RealtimeSyncBrowserDetail } from "@/components/providers/realtime-events";

export type VisibleRefreshTiming = {
  /** Quiet time after the last signal before refreshing. */
  coalesceMs: number;
  /** A steady stream of signals still refreshes this long after the first one. */
  maxWaitMs: number;
  /** Two refreshes are never closer than this. */
  minGapMs: number;
};

/** Delay until the next refresh: trailing window, capped by maxWait, never before minGap since the last one. */
export function visibleRefreshDelay(timing: VisibleRefreshTiming, firstEventAt: number, lastRefreshAt: number, now: number) {
  const trailing = Math.max(0, Math.min(timing.coalesceMs, firstEventAt + timing.maxWaitMs - now));
  return Math.max(trailing, lastRefreshAt + timing.minGapMs - now);
}

/**
 * Re-reads the server view when matching realtime signals arrive, only while the tab is visible.
 * Egress (02/11): hidden /conversas tabs re-ran the whole workspace query on every message all day
 * (about 12.8 thousand reloads a week). A hidden tab now keeps one pending refresh for when it returns.
 */
export function useVisibleRealtimeRefresh(
  matches: (detail: RealtimeSyncBrowserDetail | undefined) => boolean,
  timing: VisibleRefreshTiming,
) {
  const router = useRouter();
  const { coalesceMs, maxWaitMs, minGapMs } = timing;

  useEffect(() => {
    let timer: number | null = null;
    let firstAt = 0;
    let lastRefreshAt = 0;
    let pendingWhileHidden = false;

    const refresh = () => {
      timer = null;
      if (document.visibilityState !== "visible") {
        pendingWhileHidden = true;
        return;
      }
      lastRefreshAt = Date.now();
      router.refresh();
    };
    const schedule = () => {
      const now = Date.now();
      if (timer === null) firstAt = now;
      else window.clearTimeout(timer);
      timer = window.setTimeout(refresh, visibleRefreshDelay({ coalesceMs, maxWaitMs, minGapMs }, firstAt, lastRefreshAt, now));
    };
    const onSignal = (event: Event) => {
      if (!matches((event as CustomEvent<RealtimeSyncBrowserDetail>).detail)) return;
      if (document.visibilityState !== "visible") {
        pendingWhileHidden = true;
        return;
      }
      schedule();
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible" || !pendingWhileHidden) return;
      pendingWhileHidden = false;
      schedule();
    };

    window.addEventListener(REALTIME_SYNC_BROWSER_EVENT, onSignal);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener(REALTIME_SYNC_BROWSER_EVENT, onSignal);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [router, matches, coalesceMs, maxWaitMs, minGapMs]);
}

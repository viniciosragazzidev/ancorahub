"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { IncomingLeadCard } from "@/components/notifications/incoming-lead-card";
import {
  createIncomingLeadQueueState,
  enqueueIncomingLead,
  isAssignedLeadNotification,
  resolveIncomingLead,
  type IncomingLead,
} from "@/components/notifications/incoming-lead-queue";
import {
  dispatchRealtimeSyncEvent,
  type RealtimeSyncBrowserDetail,
} from "@/components/providers/realtime-events";
import { createClient } from "@/utils/supabase/client";

interface RealtimeSyncProviderProps {
  children: React.ReactNode;
  tenantId: string;
  userId: string;
  role: string;
  syncTopic: string | null;
}

type RecentNotification = {
  id?: string;
  title?: string;
  message?: string;
  type?: string;
  readAt?: string | null;
  createdAt?: string;
  leadId?: string | null;
};

const LEADS_REVISION_KEY = "ancorahub:leads-revision";

/**
 * Debounce coalescing: multiple events within this window produce a single refresh.
 * 500ms balances responsiveness (user sees updates within half a second) against
 * server load (a burst of 5 events produces 1 server render, not 5).
 */
const REFRESH_COALESCE_MS = 500;

/**
 * Reconciliation interval: how often to check for missed notifications when the
 * tab is visible. 60s is a safety net; the primary update path is Supabase Realtime.
 */
const RECONCILIATION_MS = 60_000;

export function RealtimeSyncProvider({ children, tenantId, userId, role, syncTopic }: RealtimeSyncProviderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const localBroadcastRef = useRef<BroadcastChannel | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const refreshPendingRef = useRef(false);
  const pendingEventsRef = useRef(0);
  const shellStartedAtRef = useRef<number | null>(null);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [incomingLeads, setIncomingLeads] = useState(createIncomingLeadQueueState);

  const isEligibleForLeadNotifications = role === "director" || role === "manager" || role === "broker";

  const isFormElementFocused = useCallback(() => {
    const element = document.activeElement;
    if (!element) return false;
    const tag = element.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" ||
      (element as HTMLElement).isContentEditable || element.getAttribute("role") === "textbox" ||
      element.closest('[role="dialog"]') !== null;
  }, []);

  /**
   * Coalesced server refresh: events arriving within REFRESH_COALESCE_MS are
   * consolidated into a single router.refresh(). This prevents a burst of 5
   * realtime events from triggering 5 separate server re-renders.
   */
  const scheduleServerRefresh = useCallback(() => {
    if (document.visibilityState !== "visible" || isFormElementFocused()) {
      refreshPendingRef.current = true;
      return;
    }
    refreshPendingRef.current = false;
    pendingEventsRef.current += 1;

    // If a timer is already running, it will pick up the coalesced event.
    if (refreshTimerRef.current !== null) return;

    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      pendingEventsRef.current = 0;
      router.refresh();
    }, REFRESH_COALESCE_MS);
  }, [isFormElementFocused, router]);

  /**
   * Client-only state sync: invalidates React Query cache, dispatches browser
   * events, and schedules a coalesced server refresh.
   */
  const syncClientState = useCallback((detail: RealtimeSyncBrowserDetail, broadcast = true) => {
    void queryClient.invalidateQueries({ queryKey: ["local-first", tenantId, userId] });
    setLastSyncedAt(Date.now());
    try {
      window.sessionStorage.setItem(LEADS_REVISION_KEY, String(Date.now()));
    } catch {
      // Browser storage unavailable — the coalesced refresh is still sufficient.
    }
    dispatchRealtimeSyncEvent(detail);
    scheduleServerRefresh();
    if (broadcast) localBroadcastRef.current?.postMessage({ type: "local-first.invalidate", detail });
  }, [queryClient, scheduleServerRefresh, tenantId, userId]);

  const reconcileRecentNotifications = useCallback(async (notificationId?: string) => {
    if (!isEligibleForLeadNotifications) return;
    try {
      const response = await fetch("/api/internal/unread-count?mode=recent", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { notifications?: RecentNotification[] };
      const graceWindowStart = (shellStartedAtRef.current ?? Date.now()) - 30_000;

      for (const notification of payload.notifications ?? []) {
        const createdAt = notification.createdAt ? Date.parse(notification.createdAt) : NaN;
        if (!notification.id || !notification.leadId || notification.readAt || !Number.isFinite(createdAt)) continue;
        if (notificationId ? notification.id !== notificationId : createdAt < graceWindowStart) continue;
        if (!isAssignedLeadNotification({
          tenant_id: tenantId,
          recipient_user_id: userId,
          type: notification.type,
          lead_id: notification.leadId,
        }, tenantId, userId)) continue;
        const resolvedNotificationId = notification.id;
        const resolvedLeadId = notification.leadId;
        setIncomingLeads((state) => enqueueIncomingLead(state, {
          notificationId: resolvedNotificationId!,
          leadId: resolvedLeadId!,
          title: notification.title ?? "Novo lead recebido",
          message: notification.message ?? "Uma nova oportunidade entrou no sistema.",
          createdAt: notification.createdAt ?? new Date().toISOString(),
        }));
      }
    } catch {
      // The next authenticated reconciliation retries without exposing data to Realtime.
    }
  }, [isEligibleForLeadNotifications, tenantId, userId]);

  const handleRemoteSignal = useCallback((detail: RealtimeSyncBrowserDetail) => {
    syncClientState(detail);
    if (detail.kind === "notification.created") {
      void reconcileRecentNotifications(detail.notificationId);
    }
  }, [reconcileRecentNotifications, syncClientState]);

  useEffect(() => {
    shellStartedAtRef.current = Date.now();
    const resumePendingRefresh = () => {
      if (refreshPendingRef.current) scheduleServerRefresh();
    };
    const onFocusOut = () => window.setTimeout(resumePendingRefresh, 0);
    window.addEventListener("focus", resumePendingRefresh);
    window.addEventListener("focusout", onFocusOut);
    document.addEventListener("visibilitychange", resumePendingRefresh);
    return () => {
      window.removeEventListener("focus", resumePendingRefresh);
      window.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", resumePendingRefresh);
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleServerRefresh]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(`ancorahub:local-first:${tenantId}:${userId}`);
    localBroadcastRef.current = channel;
    channel.onmessage = (event: MessageEvent<{ type?: string; detail?: RealtimeSyncBrowserDetail }>) => {
      if (event.data?.type === "local-first.invalidate" && event.data.detail) {
        syncClientState(event.data.detail, false);
      }
    };
    return () => {
      if (localBroadcastRef.current === channel) localBroadcastRef.current = null;
      channel.close();
    };
  }, [syncClientState, tenantId, userId]);

  useEffect(() => {
    if (!syncTopic) return;
    const supabase = createClient();
    const channel = supabase
      .channel(syncTopic, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "refresh" }, (payload) => {
        const signal = payload.payload as Partial<RealtimeSyncBrowserDetail>;
        if (!signal.notificationId || (signal.kind !== "notification.created" && signal.kind !== "notification.read")) return;
        setIsOnline(true);
        handleRemoteSignal({ kind: signal.kind, notificationId: signal.notificationId });
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setIsOnline(false);
        if (status === "SUBSCRIBED") {
          setIsOnline(true);
          setLastSyncedAt(Date.now());
        }
      });
    return () => { void supabase.removeChannel(channel); };
  }, [handleRemoteSignal, syncTopic]);

  useEffect(() => {
    if (!isEligibleForLeadNotifications) return;
    const initialReconciliation = window.setTimeout(() => void reconcileRecentNotifications(), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void reconcileRecentNotifications();
    }, RECONCILIATION_MS);
    return () => {
      window.clearTimeout(initialReconciliation);
      window.clearInterval(interval);
    };
  }, [isEligibleForLeadNotifications, reconcileRecentNotifications]);

  const resolveIncoming = useCallback((item: IncomingLead) => {
    setIncomingLeads((state) => resolveIncomingLead(state, item.notificationId));
    void fetch("/api/internal/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: item.notificationId }),
    }).catch(() => undefined);
  }, []);

  return (
    <>
      {isEligibleForLeadNotifications ? (
        <IncomingLeadCard
          item={incomingLeads.queue[0] ?? null}
          queuedCount={Math.max(0, incomingLeads.queue.length - 1)}
          onResolve={resolveIncoming}
        />
      ) : null}
      {!isOnline ? <div role="status" className="fixed inset-x-0 bottom-3 z-[70] mx-auto w-fit rounded-full border border-warning/30 bg-card px-3 py-1.5 text-xs text-warning shadow-lg">Conexão de atualização indisponível · os dados serão reconciliados ao retornar</div> : null}
      <div data-local-first-sync={lastSyncedAt ? new Date(lastSyncedAt).toISOString() : undefined}>{children}</div>
    </>
  );
}

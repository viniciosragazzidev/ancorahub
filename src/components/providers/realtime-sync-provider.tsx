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
const LIVE_REFRESH_DELAY_MS = 160;
const BROKER_RECONCILIATION_MS = 60_000;

export function RealtimeSyncProvider({ children, tenantId, userId, role, syncTopic }: RealtimeSyncProviderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const localBroadcastRef = useRef<BroadcastChannel | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const refreshPendingRef = useRef(false);
  const shellStartedAtRef = useRef<number | null>(null);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [incomingLeads, setIncomingLeads] = useState(createIncomingLeadQueueState);

  const isFormElementFocused = useCallback(() => {
    const element = document.activeElement;
    if (!element) return false;
    const tag = element.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" ||
      (element as HTMLElement).isContentEditable || element.getAttribute("role") === "textbox" ||
      element.closest('[role="dialog"]') !== null;
  }, []);

  const scheduleServerRefresh = useCallback(() => {
    if (document.visibilityState !== "visible" || isFormElementFocused()) {
      refreshPendingRef.current = true;
      return;
    }
    refreshPendingRef.current = false;
    if (refreshTimerRef.current !== null) return;
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      router.refresh();
    }, LIVE_REFRESH_DELAY_MS);
  }, [isFormElementFocused, router]);

  const syncClientState = useCallback((detail: RealtimeSyncBrowserDetail, broadcast = true) => {
    void queryClient.invalidateQueries({ queryKey: ["local-first", tenantId, userId] });
    setLastSyncedAt(Date.now());
    try {
      window.sessionStorage.setItem(LEADS_REVISION_KEY, String(Date.now()));
    } catch {
      // The immediate refresh remains sufficient when browser storage is unavailable.
    }
    dispatchRealtimeSyncEvent(detail);
    scheduleServerRefresh();
    if (broadcast) localBroadcastRef.current?.postMessage({ type: "local-first.invalidate", detail });
  }, [queryClient, scheduleServerRefresh, tenantId, userId]);

  const reconcileRecentBrokerNotifications = useCallback(async (notificationId?: string) => {
    if (role !== "broker") return;
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
          title: notification.title ?? "Novo lead atribuído",
          message: notification.message ?? "Você recebeu um novo lead para atender.",
          createdAt: notification.createdAt ?? new Date().toISOString(),
        }));
      }
    } catch {
      // The next authenticated reconciliation retries without exposing data to Realtime.
    }
  }, [role, tenantId, userId]);

  const handleRemoteSignal = useCallback((detail: RealtimeSyncBrowserDetail) => {
    syncClientState(detail);
    if (detail.kind === "notification.created") {
      void reconcileRecentBrokerNotifications(detail.notificationId);
    }
  }, [reconcileRecentBrokerNotifications, syncClientState]);

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
    if (role !== "broker") return;
    const initialReconciliation = window.setTimeout(() => void reconcileRecentBrokerNotifications(), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void reconcileRecentBrokerNotifications();
    }, BROKER_RECONCILIATION_MS);
    return () => {
      window.clearTimeout(initialReconciliation);
      window.clearInterval(interval);
    };
  }, [reconcileRecentBrokerNotifications, role]);

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
      {role === "broker" ? <IncomingLeadCard item={incomingLeads.queue[0] ?? null} queuedCount={Math.max(0, incomingLeads.queue.length - 1)} onResolve={resolveIncoming} /> : null}
      {!isOnline ? <div role="status" className="fixed inset-x-0 bottom-3 z-[70] mx-auto w-fit rounded-full border border-warning/30 bg-card px-3 py-1.5 text-xs text-warning shadow-lg">Conexão de atualização indisponível · os dados serão reconciliados ao retornar</div> : null}
      <div data-local-first-sync={lastSyncedAt ? new Date(lastSyncedAt).toISOString() : undefined}>{children}</div>
    </>
  );
}

"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

import { REALTIME_SYNC_BROWSER_EVENT, type RealtimeSyncBrowserDetail } from "@/components/providers/realtime-events";

interface NotificationCountContextValue {
  unreadCount: number;
  userId: string | null;
}

const NotificationCountContext = createContext<NotificationCountContextValue>({
  unreadCount: 0,
  userId: null,
});

export function useNotificationCount() {
  return useContext(NotificationCountContext);
}

export function NotificationCountProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/internal/unread-count", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.count === "number") {
        setUnreadCount(data.count);
      }
    } catch {
      // Silently ignore network failures
    }
  }, []);

  useEffect(() => {
    // Initial fetch on mount
    const initialFetch = window.setTimeout(() => void fetchCount(), 0);

    // POLLING REMOVED: RealtimeSyncProvider handles 60s reconciliation + realtime events.
    // The previous 120s polling was redundant with the realtime path.
    // Visibility change still triggers a single reconciliation through RealtimeSyncProvider.

    return () => {
      window.clearTimeout(initialFetch);
    };
  }, [fetchCount]);

  useEffect(() => {
    const onRealtimeSync = (event: Event) => {
      const detail = (event as CustomEvent<RealtimeSyncBrowserDetail>).detail;
      if (detail?.kind === "notification.created" || detail?.kind === "notification.read") {
        void fetchCount();
      }
    };
    window.addEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtimeSync);
    return () => window.removeEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtimeSync);
  }, [fetchCount]);

  return (
    <NotificationCountContext.Provider value={{ unreadCount, userId }}>
      {children}
    </NotificationCountContext.Provider>
  );
}

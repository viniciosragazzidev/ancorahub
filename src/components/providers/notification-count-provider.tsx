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

  // The server Broadcast signal is the primary update path. The slower fallback
  // covers a missed WebSocket frame without creating a constant request stream.
  useEffect(() => {
    const initialFetch = window.setTimeout(() => void fetchCount(), 0);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchCount();
      }
    }, 120_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchCount();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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

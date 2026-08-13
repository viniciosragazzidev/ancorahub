"use client";

import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

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
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

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

  // Fetch initial count & set fallback polling interval
  useEffect(() => {
    void fetchCount();

    // Poll every 30 seconds as fallback in case Supabase Realtime WebSocket drops
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchCount();
      }
    }, 30_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchCount();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchCount]);

  // Subscribe to real-time changes via Supabase
  useEffect(() => {
    const currentUserId = userIdRef.current;
    const supabase = createClient();
    const channelName = `notification-count:${currentUserId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${currentUserId}`,
        },
        () => {
          setUnreadCount((prev) => prev + 1);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const oldRow = payload.old as { read_at?: string | null } | null;
          const newRow = payload.new as { read_at?: string | null } | null;
          if (oldRow && newRow && !oldRow.read_at && newRow.read_at) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        },
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Realtime WebSocket desconectado. Ativando fallback via polling.", error);
          void fetchCount();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchCount]);

  return (
    <NotificationCountContext.Provider value={{ unreadCount, userId }}>
      {children}
    </NotificationCountContext.Provider>
  );
}

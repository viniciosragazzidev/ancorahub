"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
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

  // Fetch initial count on mount
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const fetchInitial = async () => {
      try {
        const res = await fetch("/api/internal/unread-count", {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data.count === "number") {
          setUnreadCount(data.count);
        }
      } catch {
        // Silently fail — subscription will catch updates
      } finally {
        // Initial fetch complete
      }
    };

    fetchInitial();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

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
          // Decrement only when readAt transitions from null → value
          if (oldRow && newRow && !oldRow.read_at && newRow.read_at) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        },
      )
      .subscribe((status, error) => {
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          console.error(
            "Falha ao assinar contagem de notificações.",
            error,
          );
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <NotificationCountContext.Provider value={{ unreadCount, userId }}>
      {children}
    </NotificationCountContext.Provider>
  );
}

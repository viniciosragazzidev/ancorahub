"use client";

import { useCallback, useEffect, startTransition } from "react";
import { toast } from "@/components/ui/sonner";
import { useRouter } from "next/navigation";

import { REALTIME_SYNC_BROWSER_EVENT, type RealtimeSyncBrowserDetail } from "@/components/providers/realtime-events";

const SNOOZE_KEY = "feedback-snooze-until";
const SNOOZE_DURATION_MS = 5 * 60 * 1000;

type RecentNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  leadId: string | null;
};

function isGloballySnoozed() {
  try {
    const snoozedUntil = localStorage.getItem(SNOOZE_KEY);
    return snoozedUntil !== null && Date.now() < Number(snoozedUntil);
  } catch {
    return false;
  }
}

function snoozeAllFeedback() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DURATION_MS));
  } catch {
    // Browser storage may be unavailable.
  }
}

/**
 * Renders feedback alerts only after the authenticated shell receives a
 * minimal server signal. Notification contents never travel in Realtime.
 */
export function FeedbackToastHandler({ userId }: { userId: string }) {
  // The server derives the recipient from the Better Auth session; this prop
  // documents that the handler remains scoped by the authenticated shell.
  void userId;
  const router = useRouter();

  const showFeedbackToast = useCallback((notification: RecentNotification) => {
    if (notification.type !== "lead_feedback_reminder" || isGloballySnoozed()) return;
    const isUrgent = notification.title.includes("urgente");

    toast.warning(notification.title, {
      description: notification.message,
      badgeLabel: "Feedback pendente",
      duration: Infinity,
      id: `feedback-${notification.id}`,
      action: notification.leadId
        ? {
            label: "Registrar agora",
            onClick: () => {
              startTransition(() => router.push(`/leads/${notification.leadId}#feedback`));
            },
          }
        : undefined,
      cancel: {
        label: "Lembrar depois",
        onClick: () => {
          snoozeAllFeedback();
        },
      },
    });
  }, [router]);

  useEffect(() => {
    const onRealtimeSync = async (event: Event) => {
      const detail = (event as CustomEvent<RealtimeSyncBrowserDetail>).detail;
      if (detail?.kind !== "notification.created") return;
      try {
        const response = await fetch("/api/internal/unread-count?mode=recent", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { notifications?: RecentNotification[] };
        const notification = payload.notifications?.find((item) => item.id === detail.notificationId);
        if (notification) showFeedbackToast(notification);
      } catch {
        // A later notification sync retries through the authenticated endpoint.
      }
    };
    window.addEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtimeSync);
    return () => window.removeEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtimeSync);
  }, [showFeedbackToast]);

  return null;
}

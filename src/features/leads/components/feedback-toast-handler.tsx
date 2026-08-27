"use client";

import { useCallback, useEffect, startTransition } from "react";
import { toast } from "@/components/ui/sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
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
    toast.custom((toastId) => (
      <div className="group relative flex w-full max-w-sm flex-col gap-3 rounded-xl border border-amber-500/30 bg-card/95 p-3.5 shadow-lg backdrop-blur-md select-none dark:bg-card/90">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Feedback pendente</p>
            <p className="mt-0.5 text-xs font-semibold leading-relaxed text-foreground">{notification.title}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{notification.message}</p>
          </div>
          <button
            type="button"
            onClick={() => toast.dismiss(toastId)}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
            aria-label="Fechar"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          {notification.leadId ? (
            <Button
              size="sm"
              className="flex-1 text-xs h-8"
              onClick={() => {
                startTransition(() => router.push(`/leads/${notification.leadId}#feedback`));
                toast.dismiss(toastId);
              }}
            >
              Registrar agora
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs h-8"
            onClick={() => {
              snoozeAllFeedback();
              toast.dismiss(toastId);
            }}
          >
            Lembrar depois
          </Button>
        </div>
        {isUrgent ? (
          <p className="text-[10px] font-medium text-destructive">Limite de tentativas excedido. O gestor foi notificado.</p>
        ) : null}
      </div>
    ), { duration: Infinity, position: "bottom-right", id: `feedback-${notification.id}` });
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

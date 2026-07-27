"use client";

import { useEffect, startTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";

const SNOOZE_KEY = "feedback-snooze-until";
const SNOOZE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface NotificationPayload {
  id: string;
  recipient_user_id: string;
  lead_id: string | null;
  type: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

function isGloballySnoozed(): boolean {
  try {
    const snoozedUntil = localStorage.getItem(SNOOZE_KEY);
    return snoozedUntil !== null && Date.now() < Number(snoozedUntil);
  } catch {
    return false;
  }
}

function snoozeAllFeedback(): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DURATION_MS));
  } catch {
    // localStorage may be unavailable
  }
}

/**
 * Listens for new `lead_feedback_reminder` notifications via Supabase Realtime
 * and shows a persistent sonner toast with "Registrar agora" / "Lembrar depois" actions.
 *
 * Must be rendered inside a dashboard layout with an active user session.
 */
export function FeedbackToastHandler({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channelName = `feedback-toast:${userId}`;

    const channel = supabase
      .channel(channelName)
      .on<NotificationPayload>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const notif = payload.new;
          if (!notif || notif.type !== "lead_feedback_reminder") return;
          if (isGloballySnoozed()) return;

          const isUrgent = notif.title.includes("urgente");
          const leadId = notif.lead_id;

          toast.custom(
            (t) => (
              <div className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">
                      Feedback pendente
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">
                      {notif.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {notif.message}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toast.dismiss(t)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Fechar"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {leadId && (
                    <Button
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => {
                        startTransition(() => {
                          router.push(`/leads/${leadId}#feedback`);
                        });
                        toast.dismiss(t);
                      }}
                    >
                      Registrar agora
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"                      onClick={() => {
                        snoozeAllFeedback();
                        toast.dismiss(t);
                      }}
                  >
                    Lembrar depois
                  </Button>
                </div>

                {isUrgent && (
                  <p className="text-[10px] font-medium text-destructive">
                    Limite de tentativas excedido. O gestor foi notificado.
                  </p>
                )}
              </div>
            ),
            {
              duration: Infinity,
              position: "bottom-right",
              style: { padding: 0, background: "transparent", boxShadow: "none", border: "none", width: "auto" },
            },
          );
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Falha ao assinar lembretes de feedback em tempo real.");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}

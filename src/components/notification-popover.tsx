"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import {
  ArrowRight,
  Bell,
  BellRinging,
  CalendarCheck,
  CheckCircle,
  Clock,
  TriangleAlertIcon,
  WarningCircle as Warning,
  XCircle,
} from "@/components/huge-icons";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useNotificationCount } from "@/components/providers/notification-count-provider";
import { PushNotificationManager } from "@/features/notifications/components/push-notification-manager";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

/* ─── Types ─── */

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  readAt: string | null;
  createdAt: string;
  leadId: string | null;
}

interface RecentNotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
  totalCount: number;
}

type Priority = "urgent" | "attention" | "info";

/* ─── Helpers ─── */

function priorityFor(type: string): Priority {
  if (["lead_unworked", "lead_stalled", "document_rejected"].includes(type))
    return "urgent";
  if (
    [
      "agent.lead_assigned",
      "lead_feedback_reminder",
      "client_renewal_reminder",
    ].includes(type)
  )
    return "attention";
  return "info";
}

function NotificationIcon({ type, className }: { type: string; className?: string }) {
  if (type === "lead_unworked") return <Warning className={className} />;
  if (type === "lead_stalled") return <TriangleAlertIcon className={className} />;
  if (type === "document_rejected") return <XCircle className={className} />;
  if (type === "agent.lead_assigned") return <Bell className={className} />;
  if (type === "lead_feedback_reminder") return <Clock className={className} />;
  if (type === "client_renewal_reminder") return <CalendarCheck className={className} />;
  if (type === "lead_reengagement") return <BellRinging className={className} />;
  return <Bell className={className} />;
}

const LIVE_NOVA_DURATION_MS = 6_000;

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/* ─── Notification Item Row ─── */

function NovaBadge({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (visible) {
      timerRef.current = setTimeout(onDismiss, LIVE_NOVA_DURATION_MS);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 18,
            mass: 0.3,
          }}
          className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold leading-none text-primary"
        >
          Nova
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function NotificationRow({
  item,
  isNew,
  onMarkRead,
  onNavigate,
  onDismissNew,
}: {
  item: NotificationItem;
  isNew: boolean;
  onMarkRead: (id: string) => void;
  onNavigate: (leadId: string) => void;
  onDismissNew: (id: string) => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const showNova = isNew && !dismissed && item.readAt === null;
  const priority = priorityFor(item.type);
  const isRead = item.readAt !== null;

  const dotColor = isRead
    ? "bg-muted-foreground/20"
    : priority === "urgent"
      ? "bg-destructive"
      : priority === "attention"
        ? "bg-warning"
        : "bg-primary";

  const iconColor = isRead
    ? "text-muted-foreground/40"
    : priority === "urgent"
      ? "text-destructive"
      : priority === "attention"
        ? "text-warning"
        : "text-primary";

  const handleMouseEnter = useCallback(() => {
    if (showNova) {
      setDismissed(true);
      onDismissNew(item.id);
    }
  }, [showNova, item.id, onDismissNew]);

  const handleNovaDismiss = useCallback(() => {
    setDismissed(true);
    onDismissNew(item.id);
  }, [item.id, onDismissNew]);

  return (
    <motion.div
      layout={showNova ? true : false}
      initial={isNew ? { opacity: 0, y: -8 } : undefined}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={handleMouseEnter}
      className={cn(
        "group relative flex items-start gap-2.5 px-4 py-2.5 transition-colors duration-150",
        "hover:bg-muted/40",
        !isRead && "bg-primary/[0.02]",
        showNova && "bg-primary/[0.04] -mx-4 rounded-none border-x-0 px-4",
        showNova && "shadow-[inset_0_1px_0_0_rgb(59_130_246_/_0.08),inset_0_-1px_0_0_rgb(59_130_246_/_0.08)]",
      )}
    >
      {/* Unread dot */}
      <div className="flex h-8 shrink-0 items-start pt-2">
        <span
          className={cn(
            "mt-0.5 block size-1.5 shrink-0 rounded-full",
            dotColor,
          )}
        />
      </div>

      {/* Icon */}
      <div
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background/60 transition-colors duration-150",
          iconColor.replace("text-", "border-").replace("/40", "/20"),
          showNova && "border-primary/20 bg-primary/[0.04]",
        )}
      >
        <NotificationIcon type={item.type} className={cn("size-4", iconColor)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <p
              className={cn(
                "truncate text-xs font-medium leading-tight",
                isRead ? "text-muted-foreground/60" : "text-foreground",
              )}
            >
              {item.title}
            </p>
            <NovaBadge visible={showNova} onDismiss={handleNovaDismiss} />
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <time
              dateTime={new Date(item.createdAt).toISOString()}
              className={cn(
                "tabular-nums text-[10px]",
                isRead
                  ? "text-muted-foreground/30"
                  : "text-muted-foreground/50",
              )}
            >
              {formatRelativeTime(new Date(item.createdAt))}
            </time>
          </div>
        </div>
        <p
          className={cn(
            "mt-0.5 line-clamp-1 text-[11px] leading-relaxed",
            isRead ? "text-muted-foreground/40" : "text-muted-foreground/70",
          )}
        >
          {item.message}
        </p>

        {/* Actions */}
        <div className="mt-1.5 flex items-center gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {item.leadId && (
            <button
              type="button"
              onClick={() => onNavigate(item.leadId!)}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-primary transition-colors duration-150 hover:bg-primary/10"
            >
              Ver lead
              <ArrowRight className="size-2.5" />
            </button>
          )}
          {!isRead && (
            <button
              type="button"
              onClick={() => onMarkRead(item.id)}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted-foreground/10 hover:text-foreground"
            >
              <CheckCircle className="size-2.5" />
              Marcar lida
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Loading Skeleton ─── */

function PopoverSkeleton() {
  return (
    <div className="space-y-3 px-4 py-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className="mt-0.5 size-8 animate-pulse rounded-lg bg-muted/60" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted/60" />
            <div className="h-2.5 w-full animate-pulse rounded bg-muted/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Component ─── */

export function NotificationPopover() {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<RecentNotificationsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [liveIds, setLiveIds] = useState<Set<string>>(() => new Set());
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const { unreadCount, userId } = useNotificationCount();
  const [anchorPosition, setAnchorPosition] = useState({ top: 0, right: 16 });

  const updateAnchorPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setAnchorPosition({
      top: rect.bottom + 8,
      right: Math.max(16, window.innerWidth - rect.right),
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    updateAnchorPosition();
    window.addEventListener("resize", updateAnchorPosition);
    window.addEventListener("scroll", updateAnchorPosition, true);
    return () => {
      window.removeEventListener("resize", updateAnchorPosition);
      window.removeEventListener("scroll", updateAnchorPosition, true);
    };
  }, [open, updateAnchorPosition]);

  const fetchRecent = useCallback(async () => {
    setLiveIds(new Set());
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/internal/unread-count?mode=recent");
      if (!res.ok) throw new Error("Falha ao carregar notificações");
      const json = await res.json();
      setData(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const dismissNew = useCallback((id: string) => {
    setLiveIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Real-time subscription for new notifications while popover is open
  useEffect(() => {
    if (!open || !userId) return;

    const supabase = createClient();
    const channelName = `notif-popover:${userId}`;

    interface NotificationPayload {
      id: string;
      recipient_user_id: string;
      tenant_id: string;
      lead_id: string | null;
      type: string;
      title: string;
      message: string;
      read_at: string | null;
      created_at: string;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as NotificationPayload | null;
          if (!newNotif) return;

          const item: NotificationItem = {
            id: newNotif.id,
            title: newNotif.title,
            message: newNotif.message,
            type: newNotif.type,
            readAt: newNotif.read_at,
            createdAt: newNotif.created_at,
            leadId: newNotif.lead_id,
          };

          // Mark as live (arrived while popover is open)
          setLiveIds((prev) => new Set(prev).add(item.id));

          // Prepend to list, keep max 5, update counts
          setData((prev) => {
            if (!prev) return prev;
            const exists = prev.notifications.some((n) => n.id === item.id);
            if (exists) return prev;
            return {
              ...prev,
              notifications: [item, ...prev.notifications].slice(0, 5),
              unreadCount: prev.unreadCount + 1,
              totalCount: prev.totalCount + 1,
            };
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as NotificationPayload | null;
          const old = payload.old as { read_at?: string | null } | null;
          if (!updated) return;

          setData((prev) => {
            if (!prev) return prev;
            const notifications = prev.notifications.map((n) =>
              n.id === updated.id
                ? {
                  ...n,
                  readAt: updated.read_at,
                  title: updated.title,
                  message: updated.message,
                  type: updated.type,
                  leadId: updated.lead_id,
                }
                : n,
            );

            // Decrement unread when transitioning read_at from null → value
            const wasRead = !!old?.read_at;
            const nowRead = !!updated.read_at;
            const unreadDelta = wasRead === false && nowRead === true ? -1 : 0;

            return {
              ...prev,
              notifications,
              unreadCount: Math.max(0, prev.unreadCount + unreadDelta),
            };
          });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Falha ao assinar notificações em tempo real no popover.");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, userId]);

  // Click outside handler
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleMarkRead = useCallback(
    async (id: string) => {
      // Optimistically mark as read in local state
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          notifications: prev.notifications.map((n) =>
            n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
          ),
          unreadCount: Math.max(0, prev.unreadCount - 1),
        };
      });

      try {
        await fetch("/api/internal/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: id }),
        });
      } catch {
        // Silent fail — optimistic update stays visible
      }
    },
    [],
  );

  const handleNavigate = useCallback(
    (leadId: string) => {
      setOpen(false);
      router.push(`/leads/${leadId}`);
    },
    [router],
  );

  return (
    <div className="relative">
      {/* Trigger */}
      <div ref={triggerRef}>
        <button
          type="button"
          onClick={() => {
            setOpen((previous) => {
              const next = !previous;
              if (next) void fetchRecent();
              return next;
            });
          }}
          className={cn(
            "group/notif-trigger relative inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-all duration-150",
            "hover:bg-muted hover:text-foreground",
            open && "bg-muted text-foreground",
          )}
          aria-label={
            unreadCount > 0
              ? `${unreadCount} notificações não lidas`
              : "Notificações"
          }
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <Bell className="size-4" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 20,
                  mass: 0.5,
                }}
                className="pointer-events-none absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 py-0.5 text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-background"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                <div
                  className="fixed inset-0 z-[70] bg-black/15 backdrop-blur-[1px] dark:bg-black/35"
                  aria-hidden="true"
                  onClick={() => setOpen(false)}
                />

                <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Notificações recentes"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              style={{
                "--notification-popover-top": `${anchorPosition.top}px`,
                "--notification-popover-right": `${anchorPosition.right}px`,
              } as CSSProperties}
              className={cn(
                "fixed inset-x-0 bottom-0 z-[80] w-full rounded-t-2xl border border-border",
                "ct-notification-popover",
                "sm:inset-x-auto sm:bottom-auto sm:right-[var(--notification-popover-right)] sm:top-[var(--notification-popover-top)] sm:w-[400px] sm:rounded-2xl",
                "flex flex-col overflow-hidden",
                "max-h-[70vh] sm:max-h-[min(30rem,calc(100vh-6rem))]",
              )}
            >
              {/* Mobile drag handle */}
              <div className="flex justify-center py-2 sm:hidden">
                <div className="h-1 w-8 rounded-full bg-muted-foreground/20" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    Notificações
                  </h2>
                  {data && data.unreadCount > 0 && (
                    <Badge
                      variant="outline"
                      className="rounded-full px-1.5 py-0 text-[10px] font-medium"
                    >
                      {data.unreadCount} não{" "}
                      {data.unreadCount === 1 ? "lida" : "lidas"}
                    </Badge>
                  )}
                </div>
                <button
                  ref={closeButtonRef}
                  autoFocus
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                  aria-label="Fechar"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              <Separator className="mx-4 w-[calc(100%-2rem)]" />

              <PushNotificationManager variant="compact" />

              {/* Content */}
              <ScrollArea className="flex-1 min-h-0">
                {error && !data ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Erro ao carregar notificações
                    </p>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        setError(false);
                        fetchRecent();
                      }}
                    >
                      Tentar novamente
                    </Button>
                  </div>
                ) : data && data.notifications.length > 0 ? (
                  <div className="divide-y divide-border/40">
                    {data.notifications.map((item) => (
                      <NotificationRow
                        key={item.id}
                        item={item}
                        isNew={liveIds.has(item.id)}
                        onMarkRead={handleMarkRead}
                        onNavigate={handleNavigate}
                        onDismissNew={dismissNew}
                      />
                    ))}
                  </div>
                ) : loading && !data ? (
                  <PopoverSkeleton />
                ) : (
                  <EmptyState animated variant="ghost" icon={Bell} title="Nenhuma notificação" description="Você verá aqui alertas de leads e tarefas." />
                )}
              </ScrollArea>

              {/* Footer - Ver todas */}
              <Separator className="mx-4 w-[calc(100%-2rem)]" />
              <div className="px-4 py-2.5">
                <Link
                  href="/notificacoes"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "group/link flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150",
                    "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span>Ver todas as notificações</span>
                  <span className="inline-flex items-center gap-1">
                    {data && data.totalCount > 0 && (
                      <span className="text-muted-foreground/50">
                        {data.totalCount} no total
                      </span>
                    )}
                    <ArrowRight className="size-3.5 transition-transform duration-150 group-hover/link:translate-x-0.5" />
                  </span>
                </Link>
              </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

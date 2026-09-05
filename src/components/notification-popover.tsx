"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { ArrowRight, Bell, CheckCircle, Clock, TriangleAlertIcon, WarningCircle as Warning, XCircle } from "@/components/huge-icons";
import { EmptyState } from "@/components/empty-state";
import { useNotificationCount } from "@/components/providers/notification-count-provider";
import { REALTIME_SYNC_BROWSER_EVENT, type RealtimeSyncBrowserDetail } from "@/components/providers/realtime-events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PushNotificationManager } from "@/features/notifications/components/push-notification-manager";
import { cn } from "@/lib/utils";

type NotificationItem = { id: string; title: string; message: string; type: string; readAt: string | null; createdAt: string; leadId: string | null };
type RecentNotificationsResponse = { notifications: NotificationItem[]; unreadCount: number; totalCount: number };

function notificationIcon(type: string) {
  if (type === "lead_unworked" || type === "lead_stalled") return type === "lead_unworked" ? Warning : TriangleAlertIcon;
  if (type === "document_rejected") return XCircle;
  if (type === "lead_feedback_reminder") return Clock;
  return Bell;
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Agora";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

export function NotificationPopover() {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const { unreadCount, userId } = useNotificationCount();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<RecentNotificationsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set());
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; right: number }>({ top: 64, right: 16 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const right = Math.max(12, window.innerWidth - rect.right);
      const top = Math.max(8, rect.bottom + 8);
      setPopoverPos({ top, right });
    }
  }, []);

  const fetchRecent = useCallback(async (preserveNew = false) => {
    if (!preserveNew) setNewIds(new Set());
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/internal/unread-count?mode=recent", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to fetch notifications");
      setData(await response.json() as RecentNotificationsResponse);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open || !userId) return;
    const onRealtimeSync = (event: Event) => {
      const detail = (event as CustomEvent<RealtimeSyncBrowserDetail>).detail;
      if (!detail) return;
      const notificationId = detail.notificationId;
      if (detail.kind === "notification.created" && notificationId) setNewIds((current) => new Set(current).add(notificationId));
      if (!notificationId) return;
      void fetchRecent(true);
    };
    window.addEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtimeSync);
    return () => window.removeEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtimeSync);
  }, [fetchRecent, open, userId]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const markRead = useCallback(async (notificationId: string) => {
    setData((current) => current ? {
      ...current,
      unreadCount: Math.max(0, current.unreadCount - (current.notifications.find((item) => item.id === notificationId)?.readAt ? 0 : 1)),
      notifications: current.notifications.map((item) => item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item),
    } : current);
    try {
      await fetch("/api/internal/mark-read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notificationId }) });
    } catch {
      void fetchRecent(true);
    }
  }, [fetchRecent]);

  const popoverContent = (
    <AnimatePresence>
      {open ? (
        <>
          <div
            className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-[1.5px] dark:bg-black/45"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Notificações recentes"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{
              top: `${popoverPos.top}px`,
              right: `${popoverPos.right}px`,
            }}
            className="fixed z-[9999] flex max-h-[75vh] w-[calc(100vw-2rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/98 shadow-2xl backdrop-blur-xl max-[559px]:inset-x-4 max-[559px]:top-16 max-[559px]:w-auto sm:max-h-[min(32rem,calc(100vh-5rem))]"
          >
            <header className="flex items-center justify-between px-4 py-3 bg-muted/20">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Notificações</h2>
                {data?.unreadCount ? (
                  <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[10px] font-medium">
                    {data.unreadCount} não lidas
                  </Badge>
                ) : null}
              </div>
              <Button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground"
                aria-label="Fechar notificações"
                size="icon-sm"
                variant="ghost"
              >
                <XCircle className="size-4" aria-hidden="true" />
              </Button>
            </header>
            <Separator className="mx-4 w-[calc(100%-2rem)]" />
            <PushNotificationManager variant="compact" />
            <ScrollArea className="min-h-0 flex-1">
              {error && !data ? (
                <div className="grid place-items-center gap-2 px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground">Não foi possível carregar as notificações.</p>
                  <Button size="xs" variant="outline" onClick={() => void fetchRecent()}>Tentar novamente</Button>
                </div>
              ) : null}
              {!error && loading && !data ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-12 animate-pulse rounded-lg bg-muted/60" />
                  ))}
                </div>
              ) : null}
              {data?.notifications.length ? (
                <div className="divide-y divide-border/40">
                  {data.notifications.map((item) => {
                    const Icon = notificationIcon(item.type);
                    const isNew = newIds.has(item.id);
                    return (
                      <motion.article
                        key={item.id}
                        initial={isNew ? { opacity: 0, y: -8 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("flex items-start gap-2.5 px-4 py-3", !item.readAt && "bg-primary/[0.03]")}
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-xs font-medium text-foreground">{item.title}</p>
                            <time className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(item.createdAt)}</time>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{item.message}</p>
                          <div className="mt-2 flex items-center gap-2">
                            {item.leadId ? (
                              <Button
                                type="button"
                                onClick={() => { setOpen(false); router.push(`/leads/${item.leadId}`); }}
                                className="h-auto gap-1 p-0 text-[10px]"
                                variant="link"
                              >
                                Ver lead <ArrowRight className="size-2.5" />
                              </Button>
                            ) : null}
                            {!item.readAt ? (
                              <Button
                                type="button"
                                onClick={() => void markRead(item.id)}
                                className="h-auto gap-1 p-0 text-[10px] text-muted-foreground"
                                variant="link"
                              >
                                <CheckCircle className="size-2.5" /> Marcar lida
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              ) : null}
              {data && !data.notifications.length ? (
                <EmptyState animated variant="ghost" icon={Bell} title="Nenhuma notificação" description="Alertas de leads, tarefas e operação aparecerão aqui." />
              ) : null}
            </ScrollArea>
            <Separator className="mx-4 w-[calc(100%-2rem)]" />
            <Link
              href="/notificacoes"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-4 py-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Ver todas as notificações <ArrowRight className="size-3.5" />
            </Link>
          </motion.section>
        </>
      ) : null}
    </AnimatePresence>
  );

  return (
    <div className="relative inline-flex items-center">
      <Button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((current) => {
            const next = !current;
            if (next) {
              updatePosition();
              void fetchRecent();
            }
            return next;
          });
        }}
        className={cn(
          "group/notif-trigger relative size-8 text-muted-foreground",
          open && "bg-muted text-foreground"
        )}
        size="icon-sm"
        variant="ghost"
        aria-label={unreadCount > 0 ? `${unreadCount} notificações não lidas` : "Notificações"}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 py-0.5 text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-background">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Button>

      {mounted && createPortal(popoverContent, document.body)}
    </div>
  );
}

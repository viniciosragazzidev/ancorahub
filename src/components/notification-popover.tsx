"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const triggerRef = useRef<HTMLButtonElement>(null);

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
    if (!open || !userId) return;
    const onRealtimeSync = (event: Event) => {
      const detail = (event as CustomEvent<RealtimeSyncBrowserDetail>).detail;
      if (!detail?.notificationId) return;
      if (detail.kind === "notification.created") setNewIds((current) => new Set(current).add(detail.notificationId));
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

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((current) => {
            const next = !current;
            if (next) void fetchRecent();
            return next;
          });
        }}
        className={cn("group/notif-trigger relative inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color,box-shadow] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] motion-reduce:transition-none", "hover:bg-muted hover:text-foreground", open && "bg-muted text-foreground")}
        aria-label={unreadCount > 0 ? `${unreadCount} notificações não lidas` : "Notificações"}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 py-0.5 text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-background">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
      </button>

      <AnimatePresence>
        {open ? <>
          <div className="fixed inset-0 z-[70] bg-black/15 backdrop-blur-[1px] dark:bg-black/35" aria-hidden="true" onClick={() => setOpen(false)} />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Notificações recentes"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 bottom-0 z-[80] flex max-h-[70vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-16 sm:w-[400px] sm:rounded-2xl sm:max-h-[min(30rem,calc(100vh-6rem))]"
          >
            <header className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2"><h2 className="text-sm font-semibold text-foreground">Notificações</h2>{data?.unreadCount ? <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[10px] font-medium">{data.unreadCount} não lidas</Badge> : null}</div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Fechar notificações">×</button>
            </header>
            <Separator className="mx-4 w-[calc(100%-2rem)]" />
            <PushNotificationManager variant="compact" />
            <ScrollArea className="min-h-0 flex-1">
              {error && !data ? <div className="grid place-items-center gap-2 px-4 py-8 text-center"><p className="text-sm text-muted-foreground">Não foi possível carregar as notificações.</p><Button size="xs" variant="outline" onClick={() => void fetchRecent()}>Tentar novamente</Button></div> : null}
              {!error && loading && !data ? <div className="space-y-3 p-4">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-muted/60" />)}</div> : null}
              {data?.notifications.length ? <div className="divide-y divide-border/40">{data.notifications.map((item) => {
                const Icon = notificationIcon(item.type);
                const isNew = newIds.has(item.id);
                return <motion.article key={item.id} initial={isNew ? { opacity: 0, y: -8 } : false} animate={{ opacity: 1, y: 0 }} className={cn("flex items-start gap-2.5 px-4 py-3", !item.readAt && "bg-primary/[0.02]")}>
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="truncate text-xs font-medium text-foreground">{item.title}</p><time className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(item.createdAt)}</time></div><p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{item.message}</p><div className="mt-2 flex items-center gap-2">{item.leadId ? <button type="button" onClick={() => { setOpen(false); router.push(`/leads/${item.leadId}`); }} className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">Ver lead <ArrowRight className="size-2.5" /></button> : null}{!item.readAt ? <button type="button" onClick={() => void markRead(item.id)} className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"><CheckCircle className="size-2.5" /> Marcar lida</button> : null}</div></div>
                </motion.article>;
              })}</div> : null}
              {data && !data.notifications.length ? <EmptyState animated variant="ghost" icon={Bell} title="Nenhuma notificação" description="Alertas de leads, tarefas e operação aparecerão aqui." /> : null}
            </ScrollArea>
            <Separator className="mx-4 w-[calc(100%-2rem)]" />
            <Link href="/notificacoes" onClick={() => setOpen(false)} className="flex items-center justify-between px-4 py-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Ver todas as notificações <ArrowRight className="size-3.5" /></Link>
          </motion.section>
        </> : null}
      </AnimatePresence>
    </div>
  );
}

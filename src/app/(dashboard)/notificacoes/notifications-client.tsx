"use client";

import { useCallback, useMemo, useOptimistic, useState, startTransition, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";

import { ArrowRight, Bell, BellRinging, CalendarCheck, CheckCircle, Clock, TriangleAlertIcon, Warning, XCircle } from "@/components/huge-icons";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PushNotificationManager } from "@/features/notifications/components/push-notification-manager";
import { loadMoreNotificationsAction, markAllNotificationsReadAction, markNotificationReadAction } from "./actions";

type Priority = "urgent" | "attention" | "info";
type FilterType = "all" | "unread" | "urgent";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  readAt: string | null;
  createdAt: string;
  leadId: string | null;
}

const FILTERS: Array<{ key: FilterType; label: string }> = [
  { key: "all", label: "Todas" },
  { key: "unread", label: "Não lidas" },
  { key: "urgent", label: "Ação necessária" },
];

function priorityFor(type: string): Priority {
  if (["lead_unworked", "lead_stalled", "document_rejected"].includes(type)) return "urgent";
  if (["agent.lead_assigned", "lead_feedback_reminder", "client_renewal_reminder"].includes(type)) return "attention";
  return "info";
}

function NotificationIcon({ type, className }: { type: string; className?: string }) {
  if (type === "lead_unworked") return <Warning className={className} />;
  if (type === "lead_stalled") return <TriangleAlertIcon className={className} />;
  if (type === "document_rejected") return <XCircle className={className} />;
  if (type === "lead_feedback_reminder") return <Clock className={className} />;
  if (type === "client_renewal_reminder") return <CalendarCheck className={className} />;
  if (type === "lead_reengagement") return <BellRinging className={className} />;
  return <Bell className={className} />;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay(date, now)) return time;
  if (sameDay(date, yesterday)) return `Ontem ${time}`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function groupByDate(items: NotificationItem[]): Array<[string, NotificationItem[]]> {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const groups = new Map<string, NotificationItem[]>([["Hoje", []], ["Ontem", []], ["Anteriores", []]]);
  for (const item of items) {
    const createdAt = new Date(item.createdAt);
    const key = sameDay(createdAt, now) ? "Hoje" : sameDay(createdAt, yesterday) ? "Ontem" : "Anteriores";
    groups.get(key)?.push(item);
  }
  return Array.from(groups.entries()).filter(([, values]) => values.length > 0);
}

function FilterButton({ active, count, label, onClick }: { active: boolean; count: number; label: string; onClick: () => void }) {
  return <button type="button" aria-current={active ? "true" : undefined} onClick={onClick} className={active ? "flex h-8 items-center gap-1.5 rounded-md bg-card px-3 text-xs font-medium text-foreground shadow-sm ring-1 ring-foreground/10 transition-colors" : "flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"}><span>{label}</span>{count > 0 && <span className={active ? "grid size-4 place-items-center rounded-full bg-primary/10 text-[10px] tabular-nums text-primary" : "grid size-4 place-items-center rounded-full bg-muted-foreground/10 text-[10px] tabular-nums"}>{count > 99 ? "99+" : count}</span>}</button>;
}

function NotificationRow({ item, isRead, onMarkRead, reduceMotion }: { item: NotificationItem; isRead: boolean; onMarkRead: (id: string) => void; reduceMotion: boolean | null }) {
  const priority = priorityFor(item.type);
  const href = item.leadId ? `/leads/${item.leadId}` : null;
  const visual = priority === "urgent" ? { warning: "border-l-destructive", icon: "text-destructive", label: "Ação necessária", variant: "destructive" as const } : priority === "attention" ? { warning: "border-l-warning", icon: "text-warning", label: "Acompanhar", variant: "warning" as const } : { warning: "border-l-primary/50", icon: "text-primary", label: "Informativo", variant: "secondary" as const };
  return <motion.article layout="position" initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className={`group border-l-[3px] ${visual.warning} bg-card transition-colors hover:bg-muted/40`}>
    <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
      <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-background ${isRead ? "text-muted-foreground/45" : visual.icon}`}><NotificationIcon type={item.type} className="size-4" /></span>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className={isRead ? "text-sm font-medium text-muted-foreground" : "text-sm font-semibold text-foreground"}>{item.title}</p><Badge variant={isRead ? "outline" : visual.variant} className="rounded-md text-[10px]">{visual.label}</Badge></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.message}</p><div className="mt-2 flex flex-wrap items-center gap-1"><Link href={href ?? "/notificacoes"} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10">{href ? "Abrir lead" : "Ver detalhes"}<ArrowRight className="size-3" /></Link>{!isRead && <button type="button" onClick={() => onMarkRead(item.id)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><CheckCircle className="size-3" />Marcar como lida</button>}</div></div>
      <time dateTime={item.createdAt} className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground/65">{formatTimestamp(item.createdAt)}</time>
    </div>
  </motion.article>;
}

function EmptyStateContent({ filter }: { filter: FilterType }) {
  const copy = filter === "unread"
    ? ["Tudo lido", "Você está em dia com as notificações."]
    : filter === "urgent"
      ? ["Nada urgente", "Não há alertas que exijam uma ação imediata."]
      : ["Nenhuma notificação", "Alertas de leads, tarefas e atualizações aparecerão aqui."];
  return <EmptyState animated icon={Bell} title={copy[0]} description={copy[1]} />;
}

interface NotificationsClientProps {
  initialNotifications: NotificationItem[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
  totalCount: number;
  unreadCount: number;
  urgentCount: number;
}

export function NotificationsClient({
  initialNotifications,
  initialNextCursor,
  initialHasMore,
  totalCount: serverTotalCount,
  unreadCount: serverUnreadCount,
  urgentCount: serverUrgentCount,
}: NotificationsClientProps) {
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState<FilterType>("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [cursor, setCursor] = useState<string | null>(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startLoadTransition] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [optimisticReads, addOptimisticRead] = useOptimistic<Set<string>, string>(new Set(), (state, id) => new Set(state).add(id));

  const localUnreadCount = useMemo(() => notifications.filter((item) => !item.readAt && !optimisticReads.has(item.id)).length, [notifications, optimisticReads]);
  const localUrgentCount = useMemo(() => notifications.filter((item) => priorityFor(item.type) === "urgent" && !item.readAt && !optimisticReads.has(item.id)).length, [notifications, optimisticReads]);
  const visibleNotifications = useMemo(() => notifications.filter((item) => { const isRead = Boolean(item.readAt) || optimisticReads.has(item.id); return filter === "all" || filter === "unread" ? filter === "all" || !isRead : priorityFor(item.type) === "urgent" && !isRead; }), [filter, notifications, optimisticReads]);
  const groups = useMemo(() => groupByDate(visibleNotifications), [visibleNotifications]);
  const markRead = useCallback(async (id: string) => { startTransition(() => addOptimisticRead(id)); const form = new FormData(); form.set("notificationId", id); await markNotificationReadAction(form); }, [addOptimisticRead]);
  const markAllRead = useCallback(async () => { const unreadIds = notifications.filter((item) => !item.readAt && !optimisticReads.has(item.id)).map((item) => item.id); startTransition(() => unreadIds.forEach(addOptimisticRead)); await markAllNotificationsReadAction(); }, [addOptimisticRead, notifications, optimisticReads]);

  const loadMore = useCallback(() => {
    if (!cursor || isPending) return;
    setLoadError(null);
    startLoadTransition(async () => {
      try {
        const result = await loadMoreNotificationsAction(cursor);
        setNotifications((prev) => [...prev, ...result.notifications]);
        setCursor(result.nextCursor);
        setHasMore(result.hasMore);
      } catch {
        setLoadError("Erro ao carregar mais notificações. Tente novamente.");
      }
    });
  }, [cursor, isPending]);

  return <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 pt-5 lg:px-6 lg:pt-7"><header className="flex flex-col gap-4 border-b border-border/80 pb-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Centro de notificações</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Notificações</h1><p className="mt-1 text-sm text-muted-foreground">Priorize o que exige ação e retome o atendimento sem perder contexto.</p></div>{localUnreadCount > 0 && <Button size="sm" variant="outline" onClick={() => void markAllRead()} className="gap-1.5 self-start"><CheckCircle className="size-3.5" />Marcar todas como lidas</Button>}</header><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"><section className="min-w-0 space-y-5" aria-label="Inbox de notificações"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{serverTotalCount}</span> no total <span className="mx-1 text-border">/</span><span className="font-medium text-primary">{serverUnreadCount}</span> não lidas{serverUrgentCount > 0 && <><span className="mx-1 text-border">/</span><span className="font-medium text-destructive">{serverUrgentCount}</span> urgentes</>}</p><div className="inline-flex w-fit items-center rounded-lg border border-border/80 bg-muted/60 p-1">{FILTERS.map((entry) => <FilterButton key={entry.key} active={filter === entry.key} count={entry.key === "all" ? serverTotalCount : entry.key === "unread" ? serverUnreadCount : serverUrgentCount} label={entry.label} onClick={() => setFilter(entry.key)} />)}</div></div><AnimatePresence mode="wait">{groups.length > 0 ? <motion.div key={filter} initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="space-y-5">{groups.map(([label, items]) => <section key={label}><div className="mb-2 flex items-center gap-2"><h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h2><span className="grid size-4 place-items-center rounded-full bg-muted text-[10px] tabular-nums text-muted-foreground">{items.length}</span><span className="h-px flex-1 bg-border/60" /></div><div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"><AnimatePresence initial={false}>{items.map((item) => <NotificationRow key={item.id} item={item} isRead={Boolean(item.readAt) || optimisticReads.has(item.id)} onMarkRead={(id) => void markRead(id)} reduceMotion={reduceMotion} />)}</AnimatePresence></div></section>)}</motion.div> : <EmptyStateContent filter={filter} />}</AnimatePresence>{hasMore && <div className="flex justify-center pt-2"><Button variant="outline" size="sm" onClick={loadMore} disabled={isPending} className="gap-2">{isPending ? <><span className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />Carregando...</> : `Carregar mais`}</Button></div>}{loadError && <p className="text-center text-xs text-destructive">{loadError}</p>}</section><aside className="space-y-3 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)]" aria-label="Configuração de push"><div><p className="text-sm font-semibold">Não perca novas oportunidades</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Ative o push neste dispositivo para acompanhar o que precisa da sua atenção.</p></div><PushNotificationManager /></aside></div></main>;
}

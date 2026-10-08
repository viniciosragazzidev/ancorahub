"use client";

import { useCallback, useMemo, useOptimistic, useState, startTransition, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";

import { ArrowRight, Bell, BellRinging, CalendarCheck, CheckCircle, Clock, TriangleAlertIcon, Warning, XCircle } from "@/components/huge-icons";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { PushNotificationManager } from "@/features/notifications/components/push-notification-manager";
import { LightLeadToastToggle } from "./light-lead-toast-toggle";
import { loadMoreNotificationsAction, markAllNotificationsReadAction, markNotificationReadAction } from "@/app/(dashboard)/notificacoes/actions";

type Priority = "urgent" | "attention" | "info";
type FilterType = "all" | "unread" | "urgent";

export interface LightNotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  readAt: string | null;
  createdAt: string;
  leadId: string | null;
}

interface LightNotificationsProps {
  initialNotifications: LightNotificationItem[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
  totalCount: number;
  unreadCount: number;
  urgentCount: number;
  leadToastEnabled: boolean;
}

const FILTERS: Array<{ value: FilterType; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "Não lidas" },
  { value: "urgent", label: "Ação necessária" },
];

const CARD_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  borderRadius: "var(--radius-surface)",
  boxShadow: "var(--shadow-resting)",
};

function priorityFor(type: string): Priority {
  if (["lead_unworked", "lead_stalled", "document_rejected"].includes(type)) return "urgent";
  if (["agent.lead_assigned", "lead_feedback_reminder", "client_renewal_reminder"].includes(type)) return "attention";
  return "info";
}

const PRIORITY_UI: Record<Priority, { color: string; tone: "warning" | "info"; label: string }> = {
  urgent: { color: "var(--warning)", tone: "warning", label: "Ação necessária" },
  attention: { color: "var(--text-secondary)", tone: "info", label: "Acompanhar" },
  info: { color: "var(--accent)", tone: "info", label: "Informativo" },
};

function NotificationIcon({ type, className, style }: { type: string; className?: string; style?: React.CSSProperties }) {
  if (type === "lead_unworked") return <Warning className={className} style={style} />;
  if (type === "lead_stalled") return <TriangleAlertIcon className={className} style={style} />;
  if (type === "document_rejected") return <XCircle className={className} style={style} />;
  if (type === "lead_feedback_reminder") return <Clock className={className} style={style} />;
  if (type === "client_renewal_reminder") return <CalendarCheck className={className} style={style} />;
  if (type === "lead_reengagement") return <BellRinging className={className} style={style} />;
  return <Bell className={className} style={style} />;
}

const TIME_ZONE = "America/Sao_Paulo";
const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);

function formatTimestamp(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
  if (sameDay(date, now)) return time;
  if (sameDay(date, yesterday)) return `Ontem ${time}`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TIME_ZONE });
}

function groupByDate(items: LightNotificationItem[]): Array<[string, LightNotificationItem[]]> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const groups = new Map<string, LightNotificationItem[]>([["Hoje", []], ["Ontem", []], ["Anteriores", []]]);
  for (const item of items) {
    const createdAt = new Date(item.createdAt);
    const key = sameDay(createdAt, now) ? "Hoje" : sameDay(createdAt, yesterday) ? "Ontem" : "Anteriores";
    groups.get(key)?.push(item);
  }
  return Array.from(groups.entries()).filter(([, values]) => values.length > 0);
}

function NotificationRow({
  item,
  isRead,
  onMarkRead,
  reduceMotion,
}: {
  item: LightNotificationItem;
  isRead: boolean;
  onMarkRead: (id: string) => void;
  reduceMotion: boolean | null;
}) {
  const priority = priorityFor(item.type);
  const ui = PRIORITY_UI[priority];
  const href = item.type === "situation_suggestion" ? "/atendimento/situacoes?view=sugestoes" : item.leadId ? `/leads/${item.leadId}` : null;
  const iconColor = isRead ? "var(--text-muted)" : ui.color;

  return (
    <motion.article
      layout="position"
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -4, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.exit] } }}
      transition={reduceMotion ? { duration: motionTokens.duration.instant } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
      className="px-4 py-4 sm:px-5"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 shrink-0">
          <NotificationIcon type={item.type} className="size-5" style={{ color: iconColor }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm" style={{ color: isRead ? "var(--text-secondary)" : "var(--foreground)", fontWeight: isRead ? 400 : 500 }}>
              {item.title}
            </p>
            {!isRead && <Badge tone={ui.tone} size="sm">{ui.label}</Badge>}
          </div>
          <p className="mt-1 text-sm leading-5" style={{ color: "var(--text-secondary)" }}>{item.message}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {href && (
              <Link
                href={href}
                className="inline-flex h-11 items-center gap-1 rounded-full px-3 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ color: "var(--accent)" }}
              >
                {item.type === "situation_suggestion" ? "Revisar sugestão" : "Abrir lead"}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            )}
            {!isRead && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onMarkRead(item.id)}>
                <CheckCircle className="size-3.5" aria-hidden="true" />
                Marcar como lida
              </Button>
            )}
          </div>
        </div>
        <time dateTime={item.createdAt} className="shrink-0 pt-0.5 text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
          {formatTimestamp(item.createdAt)}
        </time>
      </div>
    </motion.article>
  );
}

function EmptyStateContent({ filter, onSeeAll }: { filter: FilterType; onSeeAll: () => void }) {
  if (filter === "unread") {
    return <EmptyState label="Nenhuma notificação não lida" icon={<CheckCircle width={24} height={24} strokeWidth={1.5} />} title="Tudo lido" description="Você está em dia com as notificações." />;
  }
  if (filter === "urgent") {
    return (
      <EmptyState
        label="Nenhum alerta urgente"
        icon={<Bell width={24} height={24} strokeWidth={1.5} />}
        title="Nada urgente"
        description="Não há alertas que exijam uma ação imediata."
        action={<Button variant="secondary" onClick={onSeeAll}>Ver todas</Button>}
      />
    );
  }
  return <EmptyState label="Nenhuma notificação" icon={<Bell width={24} height={24} strokeWidth={1.5} />} title="Nenhuma notificação" description="Alertas de leads, tarefas e atualizações aparecerão aqui." />;
}

export function LightNotifications({
  initialNotifications,
  initialNextCursor,
  initialHasMore,
  totalCount: serverTotalCount,
  unreadCount: serverUnreadCount,
  urgentCount: serverUrgentCount,
  leadToastEnabled,
}: LightNotificationsProps) {
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState<FilterType>("all");
  const [notifications, setNotifications] = useState<LightNotificationItem[]>(initialNotifications);
  const [cursor, setCursor] = useState<string | null>(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startLoadTransition] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [optimisticReads, addOptimisticRead] = useOptimistic<Set<string>, string>(new Set(), (state, id) => new Set(state).add(id));

  const localUnreadCount = useMemo(() => notifications.filter((item) => !item.readAt && !optimisticReads.has(item.id)).length, [notifications, optimisticReads]);
  const localUrgentCount = useMemo(() => notifications.filter((item) => priorityFor(item.type) === "urgent" && !item.readAt && !optimisticReads.has(item.id)).length, [notifications, optimisticReads]);
  const visibleNotifications = useMemo(
    () => notifications.filter((item) => {
      const isRead = Boolean(item.readAt) || optimisticReads.has(item.id);
      if (filter === "all") return true;
      if (filter === "unread") return !isRead;
      return priorityFor(item.type) === "urgent" && !isRead;
    }),
    [filter, notifications, optimisticReads],
  );
  const groups = useMemo(() => groupByDate(visibleNotifications), [visibleNotifications]);

  const markRead = useCallback(async (id: string) => {
    startTransition(() => addOptimisticRead(id));
    const form = new FormData();
    form.set("notificationId", id);
    await markNotificationReadAction(form);
  }, [addOptimisticRead]);

  const markAllRead = useCallback(async () => {
    const unreadIds = notifications.filter((item) => !item.readAt && !optimisticReads.has(item.id)).map((item) => item.id);
    startTransition(() => unreadIds.forEach(addOptimisticRead));
    await markAllNotificationsReadAction();
  }, [addOptimisticRead, notifications, optimisticReads]);

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
        setLoadError("Não foi possível carregar mais notificações. Tente novamente.");
      }
    });
  }, [cursor, isPending]);

  return (
    <div className="arc-venancor flex min-h-full flex-col" style={{ color: "var(--foreground)" }}>
      <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 pb-6 pt-2 sm:px-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="sr-only">Notificações</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {serverTotalCount} no total, {serverUnreadCount} não lidas
              {serverUrgentCount > 0 ? `, ${serverUrgentCount} ação necessária` : null}
            </p>
          </div>
          {localUnreadCount > 0 && (
            <Button variant="secondary" size="sm" className="self-start" onClick={() => void markAllRead()}>
              Marcar todas como lidas
            </Button>
          )}
        </header>

        <section aria-label="Inbox de notificações" className="space-y-5">
          <SegmentedControl
            label="Filtrar notificações"
            options={FILTERS}
            value={filter}
            onValueChange={(value) => setFilter(value as FilterType)}
          />

          <AnimatePresence mode="wait">
            {groups.length > 0 ? (
              <motion.div
                key={filter}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -4, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.exit] } }}
                transition={reduceMotion ? { duration: motionTokens.duration.instant } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
                className="space-y-6"
              >
                {groups.map(([label, items]) => (
                  <section key={label} aria-label={label}>
                    <h2 className="mb-2 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                      {label}
                      <span className="ml-2 tabular-nums">{items.length}</span>
                    </h2>
                    <div className="overflow-hidden" style={CARD_STYLE}>
                      {items.map((item, index) => (
                        <div key={item.id} style={index > 0 ? { borderTop: "1px solid var(--border-subtle)" } : undefined}>
                          <NotificationRow item={item} isRead={Boolean(item.readAt) || optimisticReads.has(item.id)} onMarkRead={(id) => void markRead(id)} reduceMotion={reduceMotion} />
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </motion.div>
            ) : (
              <motion.div key={filter} className="pt-4" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduceMotion ? { duration: 0 } : { duration: motionTokens.duration.fast }}>
                <div style={CARD_STYLE} className="px-4 py-10">
                  <EmptyStateContent filter={filter} onSeeAll={() => setFilter("all")} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {hasMore && (
            <div className="flex flex-col items-center gap-3 pt-1">
              <Button variant="secondary" size="sm" onClick={loadMore} loading={isPending}>
                Carregar mais
              </Button>
              {isPending && <Skeleton lines={2} label="Carregando notificações" className="w-full" />}
            </div>
          )}
          {loadError && (
            <p className="text-center text-sm" style={{ color: "var(--danger)" }}>{loadError}</p>
          )}
        </section>

        <section aria-label="Configuração de alertas" className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Não perca novas oportunidades</h2>
            <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
              Ative o push neste dispositivo para acompanhar o que precisa da sua atenção.
            </p>
          </div>
          <PushNotificationManager />
          <LightLeadToastToggle initialEnabled={leadToastEnabled} />
        </section>
      </div>
    </div>
  );
}

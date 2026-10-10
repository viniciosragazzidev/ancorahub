"use client";

import { useCallback, useMemo, useOptimistic, useState, startTransition, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";

import { ArrowRight, Bell, BellRinging, CalendarCheck, CheckCircle, Clock, TriangleAlertIcon, Warning, XCircle } from "@/components/huge-icons";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { PushNotificationManager } from "@/features/notifications/components/push-notification-manager";
import { LightLeadToastToggle } from "./light-lead-toast-toggle";
import css from "./light-notifications.module.css";
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


type Category = "gestao" | "lead" | "plantao" | "alerta" | "info";

/** Who the notice is about, for the color of its icon (same idea as the assistants' colors). */
function categoryFor(item: Pick<LightNotificationItem, "type" | "leadId">): Category {
  if (priorityFor(item.type) === "urgent") return "alerta";
  if (item.type.startsWith("relationship.") || item.type === "manager_note") return "gestao";
  if (item.type.includes("duty") || item.type.includes("plantao")) return "plantao";
  if (item.leadId || item.type.startsWith("lead") || item.type.includes("lead")) return "lead";
  return "info";
}

const CATEGORY_LABEL: Record<Category, string> = { gestao: "Gestão", lead: "Lead", plantao: "Plantão", alerta: "Ação necessária", info: "Aviso" };

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
  const category = categoryFor(item);
  const href = item.type === "situation_suggestion" ? "/atendimento/situacoes?view=sugestoes" : item.leadId ? `/leads/${item.leadId}` : null;
  const body = (
    <>
      <span className={`${css.icon} ${css[category]}`} aria-hidden="true">
        <NotificationIcon type={item.type} className="size-5" />
      </span>
      <span className={css.text}>
        <span className={css.top}>
          <span className={`${css.title} ${isRead ? "" : css.titleUnread}`}>{item.title}</span>
          <time dateTime={item.createdAt} className={css.time}>{formatTimestamp(item.createdAt)}</time>
        </span>
        <span className={css.message}>{item.message}</span>
        <span className={css.meta}>
          <span className={`${css.tag} ${css[category]}`}>{CATEGORY_LABEL[category]}</span>
          {href ? <span className={css.open}>{item.type === "situation_suggestion" ? "Revisar sugestão" : "Abrir lead"} <ArrowRight className="size-3" aria-hidden="true" /></span> : null}
        </span>
      </span>
      {!isRead ? <span className={css.dot} aria-label="Não lida" /> : null}
    </>
  );

  return (
    <motion.li
      layout="position"
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -4, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.exit] } }}
      transition={reduceMotion ? { duration: motionTokens.duration.instant } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
      className={css.item}
    >
      {href ? (
        // Opening a notice reads it.
        <Link href={href} className={css.row} onClick={() => { if (!isRead) onMarkRead(item.id); }}>{body}</Link>
      ) : (
        <button type="button" className={css.row} onClick={() => { if (!isRead) onMarkRead(item.id); }}>{body}{!isRead ? <span className="sr-only">Toque para marcar como lida</span> : null}</button>
      )}
    </motion.li>
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
        <header className={css.header}>
          <h1 className="sr-only">Notificações</h1>
          <div className={css.summary}>
            <span className={css.summaryNumber}>{localUnreadCount}</span>
            <span className={css.summaryText}>
              <span className={css.summaryTitle}>{localUnreadCount === 1 ? "aviso novo" : localUnreadCount ? "avisos novos" : "Tudo em dia"}</span>
              <span className={css.summaryDetail}>
                {serverTotalCount} no total{serverUrgentCount > 0 ? ` · ${serverUrgentCount} pedem ação` : ""}
              </span>
            </span>
          </div>
          {localUnreadCount > 0 && (
            <Button variant="secondary" size="sm" onClick={() => void markAllRead()}>
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
                    <h2 className={css.day}>{label}</h2>
                    <ul className={css.list}>
                      {items.map((item) => (
                        <NotificationRow key={item.id} item={item} isRead={Boolean(item.readAt) || optimisticReads.has(item.id)} onMarkRead={(id) => void markRead(id)} reduceMotion={reduceMotion} />
                      ))}
                    </ul>
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

        <section aria-label="Configuração de alertas" className={css.settings}>
          <div>
            <h2 className={css.settingsTitle}>Avisos neste aparelho</h2>
            <p className={css.settingsDetail}>Ative o push para não perder lead nem recado da gestão.</p>
          </div>
          <PushNotificationManager />
          <LightLeadToastToggle initialEnabled={leadToastEnabled} />
        </section>
      </div>
    </div>
  );
}

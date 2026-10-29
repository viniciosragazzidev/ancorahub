"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { ArrowsClockwise } from "@/components/huge-icons";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { motionTokens } from "@/components/arc/motion-tokens";
import { REALTIME_SYNC_BROWSER_EVENT, type RealtimeSyncBrowserDetail } from "@/components/providers/realtime-events";
import { mergeEligibleOrderKeepingBlockedSlots } from "@/features/lead-distribution/duty-queue-order";
import { resetDutyManualQueueAction, saveDutyManualQueueAction } from "@/features/lead-distribution/duty-queue-order-actions";
import type { DutyBrokerTurnStats, DutyQueueOrderPreview } from "@/features/lead-distribution/duty-queue-order-queries";
import { cn } from "@/lib/utils";

import styles from "./duty-queue-order-board.module.css";

const timeZone = "America/Sao_Paulo";
const POLL_MS = 60_000;
const SIGNAL_DEBOUNCE_MS = 2_000;

function subscribeMotionPreference(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  const observer = new MutationObserver(onChange);
  query.addEventListener("change", onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduce-motion"] });
  return () => {
    query.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

function readMotionPreference() {
  return document.documentElement.dataset.reduceMotion === "1"
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useReduceMotionPreference() {
  return useSyncExternalStore(subscribeMotionPreference, readMotionPreference, () => false);
}

function dateLabel(value: string) {
  const date = new Date(`${value}T12:00:00-03:00`);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone }).format(date);
}

const clock = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone });

function acceptLabel(seconds: number | null) {
  if (seconds === null) return null;
  if (seconds < 60) return `aceita em ${seconds}s`;
  return `aceita em ~${Math.round(seconds / 60)} min`;
}

/** Rotation line of a broker: turns, skips, how fast they accept and when they arrived. */
function turnStatsLine(stats: DutyBrokerTurnStats) {
  return [
    `${stats.turns} ${stats.turns === 1 ? "vez" : "vezes"}`,
    stats.skips ? `${stats.skips} ${stats.skips === 1 ? "pulo" : "pulos"}` : null,
    acceptLabel(stats.avgAcceptSeconds),
    stats.arrivedAt ? `chegou ${clock.format(new Date(stats.arrivedAt))}` : null,
  ].filter(Boolean).join(" · ");
}

const OUTCOME_LABEL = { accepted: "Aceitou", skip: "Pulou a vez", waiting: "Aguardando" } as const;

/**
 * Anterior, atual and próximo of the rotation. Each slot is keyed by the broker, so when the turn
 * moves the names slide one step to the left; the current one keeps a slow pulse while waiting.
 */
function TurnStrip({ preview, nextId, nextName, reduceMotion }: { preview: DutyQueueOrderPreview; nextId: string | null; nextName: string | null; reduceMotion: boolean }) {
  const slots = [
    { role: "previous", label: "Anterior", id: preview.previous?.id ?? null, name: preview.previous?.name ?? null, detail: preview.previous ? `${OUTCOME_LABEL[preview.previous.outcome]} · ${clock.format(new Date(preview.previous.offeredAt))}` : "Ninguém ainda" },
    { role: "current", label: "Recebendo agora", id: preview.current?.id ?? null, name: preview.current?.name ?? null, detail: preview.current ? `Aguardando aceite desde ${clock.format(new Date(preview.current.offeredAt))}` : "Nenhum lead em oferta" },
    { role: "next", label: "Próximo", id: nextId, name: nextName, detail: nextId ? "Recebe o próximo lead" : "Ninguém disponível" },
  ] as const;
  return (
    <div className={styles.turnStrip} role="group" aria-label={`Vez no ${preview.scheduleName}`}>
      {slots.map((slot) => (
        <div key={slot.role} className={styles.turnSlot} data-turn={slot.role} data-empty={slot.id ? undefined : "true"}>
          <span className={styles.turnLabel}>{slot.label}</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={slot.id ?? "empty"}
              className={styles.turnPerson}
              initial={reduceMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -16 }}
              transition={reduceMotion ? { duration: 0 } : motionTokens.spring.smooth}
            >
              <span className={styles.turnName}>{slot.name ?? "Sem corretor"}</span>
              <span className={styles.turnDetail}>{slot.detail}</span>
            </motion.span>
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

function SortableBrokerRow({
  preview,
  position,
  canReorder,
  tied,
  reduceMotion,
  rotation,
}: {
  preview: DutyQueueOrderPreview["order"][number];
  position: number;
  canReorder: boolean;
  tied: boolean;
  reduceMotion: boolean;
  rotation: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: preview.id, disabled: !canReorder });
  return (
    <motion.li
      ref={setNodeRef}
      layout={reduceMotion ? false : "position"}
      transition={reduceMotion ? { duration: 0 } : motionTokens.spring.smooth}
      className={cn(styles.row, preview.isNext && styles.rowNext)}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 1 : undefined, opacity: isDragging ? 0.7 : 1 }}
      whileTap={canReorder && !reduceMotion ? { scale: motionTokens.scale.pressRow } : undefined}
      aria-current={preview.isNext ? "true" : undefined}
    >
      {canReorder ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={styles.dragHandle}
          aria-label={`Reordenar ${preview.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </Button>
      ) : (
        <span className={styles.position}>{position}º</span>
      )}
      <span className={styles.identity}>
        <span className={styles.nameLine}>
          <span className={styles.name}>{preview.name}</span>
          {preview.isNext ? <span className={styles.nextBadge}>Próximo</span> : null}
          {tied ? <span className={styles.tieBadge}>Empate no sorteio</span> : null}
        </span>
        <span className={styles.meta}>
          {rotation
            ? turnStatsLine(preview)
            : `${preview.receivedInDuty} ${preview.receivedInDuty === 1 ? "indicação" : "indicações"} na operação · ${preview.activeLeads} ${preview.activeLeads === 1 ? "lead" : "leads"} no plantão`}
        </span>
      </span>
      {canReorder ? <span className={styles.position} aria-hidden="true">{position}º</span> : null}
    </motion.li>
  );
}

function orderSignature(preview: DutyQueueOrderPreview) {
  return preview.savedBrokerIds.join("\u0000");
}

export function DutyQueueOrderBoard({ previews, canReorder }: { previews: DutyQueueOrderPreview[] | null; canReorder: boolean }) {
  const router = useRouter();
  const reduceMotion = useReduceMotionPreference();
  const [orders, setOrders] = useState<Record<string, { source: string; order: string[] }>>({});
  const [savingScheduleId, setSavingScheduleId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const refresh = useCallback(() => router.refresh(), [router]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    let timer: number | null = null;
    const onRealtime = (event: Event) => {
      const detail = (event as CustomEvent<RealtimeSyncBrowserDetail>).detail;
      if (detail?.kind !== "domain.invalidated") return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => { timer = null; refresh(); }, SIGNAL_DEBOUNCE_MS);
    };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtime);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtime);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  async function saveOrder(preview: DutyQueueOrderPreview, nextOrder: string[]) {
    setSavingScheduleId(preview.scheduleId);
    setOrders((current) => ({ ...current, [preview.scheduleId]: { source: orderSignature(preview), order: nextOrder } }));
    const result = await saveDutyManualQueueAction({ scheduleId: preview.scheduleId, dutyDate: preview.dutyDate, brokerIds: nextOrder });
    setSavingScheduleId(null);
    if (!result.ok) {
      setOrders((current) => {
        const next = { ...current };
        delete next[preview.scheduleId];
        return next;
      });
      toast.error(result.reason);
      return;
    }
    toast.success("Fila do plantão atualizada.");
    router.refresh();
  }

  async function resetOrder(preview: DutyQueueOrderPreview) {
    setOrders((current) => {
      const next = { ...current };
      delete next[preview.scheduleId];
      return next;
    });
    setSavingScheduleId(preview.scheduleId);
    const result = await resetDutyManualQueueAction({ scheduleId: preview.scheduleId, dutyDate: preview.dutyDate });
    setSavingScheduleId(null);
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    toast.success(preview.rotation ? "Fila voltou à ordem de chegada." : "Fila voltou ao automático.");
    router.refresh();
  }

  async function onDragEnd(event: DragEndEvent, preview: DutyQueueOrderPreview) {
    const { active, over } = event;
    if (!over || active.id === over.id || !canReorder) return;
    const localOrder = orders[preview.scheduleId];
    const current = localOrder?.source === orderSignature(preview) ? localOrder.order : preview.savedBrokerIds;
    const eligibleIds = new Set(preview.order.map((item) => item.id));
    const movable = current.filter((id) => eligibleIds.has(id));
    const from = movable.indexOf(String(active.id));
    const to = movable.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const reordered = arrayMove(movable, from, to);
    const rosterIds = [...preview.order.map((item) => item.id), ...preview.blocked.map((item) => item.id)];
    const nextOrder = mergeEligibleOrderKeepingBlockedSlots(
      current,
      rosterIds,
      reordered,
      preview.blocked.map((item) => item.id),
    );
    await saveOrder(preview, nextOrder);
  }

  return (
    <section className={styles.board} aria-labelledby="duty-queue-order-title">
      <div className={styles.intro}>
        <h2 id="duty-queue-order-title">Quem recebe o próximo lead</h2>
        <p>Prévia da fila de cada plantão em andamento. A escolha final é recalculada quando o lead chega.</p>
      </div>
      {previews === null ? <p className={styles.empty}>Não foi possível montar a prévia da fila agora. A distribuição dos leads segue normal.</p> : !previews.length ? <p className={styles.empty}>Nenhum plantão está em andamento agora.</p> : (
        <div className={styles.cards}>
          {previews.map((preview) => {
            const localOrder = orders[preview.scheduleId];
            const currentOrder = localOrder?.source === orderSignature(preview) ? localOrder.order : preview.savedBrokerIds;
            const visibleIds = new Set(preview.order.map((item) => item.id));
            const sortedOrder = currentOrder.filter((id) => visibleIds.has(id));
            const orderedRows = sortedOrder.flatMap((id) => {
              const item = preview.order.find((candidate) => candidate.id === id);
              return item ? [item] : [];
            });
            const tieIds = new Set(preview.order.filter((item) => item.tie).map((item) => item.id));
            const isSaving = savingScheduleId === preview.scheduleId;
            // In the rotation the broker receiving now is already shown in the turn strip.
            const blockedRows = preview.rotation && preview.current ? preview.blocked.filter((entry) => entry.id !== preview.current!.id) : preview.blocked;
            return (
              <Card key={preview.scheduleId} variant="overview" className={styles.card}>
                <CardHeader className={styles.cardHeader}>
                  <div className="min-w-0">
                    <CardTitle className={styles.cardTitle}>{preview.scheduleName} · {dateLabel(preview.dutyDate)}</CardTitle>
                    <p className={styles.queueName}>{preview.queueName}</p>
                  </div>
                  <div className={styles.headerActions}>
                    {preview.rotation ? <span className={styles.manualState}>Rodízio</span> : preview.manual ? <span className={styles.manualState}>Fila manual</span> : null}
                    {canReorder && (preview.manual || preview.rotation) ? (
                      <Button type="button" size="sm" variant="outline" disabled={isSaving} onClick={() => { void resetOrder(preview); }} className={styles.resetButton}>
                        <ArrowsClockwise className="size-4" aria-hidden="true" />
                        {preview.rotation ? "Restaurar ordem de chegada" : "Voltar ao automático"}
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className={styles.body}>
                  {preview.rotation ? (
                    <TurnStrip preview={preview} nextId={orderedRows[0]?.id ?? null} nextName={orderedRows[0]?.name ?? null} reduceMotion={reduceMotion} />
                  ) : null}
                  <p className={styles.note}>{isSaving
                    ? "Salvando a ordem…"
                    : preview.rotation
                      ? "Cada um tem sua vez, na ordem em que chegou: quem recebe vai para o fim. Lead expirado ou recusado gasta a vez e conta como pulo; no 3º pulo o corretor entra em pausa."
                      : preview.manual ? "O corretor disponível no início da fila recebe e vai para o fim." : "Ordem automática, com indicação quando houver empate."}</p>
                  {orderedRows.length ? (
                    <DndContext
                      id={`duty-queue-${preview.scheduleId}`}
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      modifiers={[restrictToVerticalAxis]}
                      onDragEnd={(event) => { void onDragEnd(event, preview); }}
                    >
                      <SortableContext items={orderedRows.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                        <ol className={styles.rows} aria-label={`Fila de ${preview.scheduleName}`}>
                          {orderedRows.map((item, index) => (
                            <SortableBrokerRow
                              key={item.id}
                              preview={{ ...item, isNext: preview.manual || preview.rotation ? index === 0 : item.isNext }}
                              position={index + 1}
                              canReorder={canReorder && !isSaving}
                              tied={!preview.manual && !preview.rotation && tieIds.has(item.id)}
                              reduceMotion={reduceMotion}
                              rotation={preview.rotation}
                            />
                          ))}
                        </ol>
                      </SortableContext>
                    </DndContext>
                  ) : <p className={styles.empty}>Ninguém está disponível para receber agora.</p>}
                  {blockedRows.length ? (
                    <div className={styles.blocked}>
                      <p className={styles.blockedTitle}>Bloqueados nesta rodada</p>
                      {blockedRows.map((entry) => (
                        <div key={entry.id} className={styles.blockedRow}>
                          <span className={styles.blockedName}>{entry.name}</span>
                          <span className={styles.blockedReason}>{preview.rotation && entry.skips ? `${entry.reason} · ${entry.skips} ${entry.skips === 1 ? "pulo" : "pulos"}` : entry.reason}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { saveDutyManualQueueAction } from "@/features/lead-distribution/duty-queue-order-actions";
import { moveDutyTurn } from "@/features/lead-distribution/duty-turn-core";
import { cn } from "@/lib/utils";

/** `key` is the roster row (a broker can be on the weekly and the dated roster); `id` is the broker. */
type Item = { key: string; id: string; name: string; node: ReactNode };

function SortableCard({ item, movable, disabled, isOver }: { item: Item; movable: boolean; disabled: boolean; isOver: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: item.key, disabled: !movable || disabled });
  return (
    <div ref={setNodeRef} className={cn("relative rounded-[var(--radius-card)]", isDragging && "opacity-40", isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background")}>
      {item.node}
      {movable ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1.5 right-1.5 z-20 cursor-grab touch-none active:cursor-grabbing"
          aria-label={`Arrastar ${item.name} para outra posição na vez`}
          title="Arraste para mudar a vez"
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Active broker cards of a running plantão that the director can drag to change the turn (29/10):
 * drop a card on another and it takes that place. Siblings do not shift while dragging (the cards
 * already slide on their own when the order changes), the target card just gets a ring.
 */
export function DutyTurnSortableGrid({ scheduleId, dutyDate, order, queue, items, className }: {
  scheduleId: string;
  dutyDate: string;
  order: string[];
  queue: string[];
  items: Item[];
  className?: string;
}) {
  const router = useRouter();
  const signature = order.join("\u0000");
  const [local, setLocal] = useState<{ source: string; order: string[]; queue: string[] } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const current = local?.source === signature ? local : { order, queue };
  const movable = new Set(current.queue);
  // Cards follow the turn: whoever moved takes the new place right away, before the page refreshes.
  const queueItems = current.queue.flatMap((id) => items.filter((item) => item.id === id));
  const firstQueueIndex = items.findIndex((item) => movable.has(item.id));
  const sorted = firstQueueIndex < 0 ? items : [
    ...items.slice(0, firstQueueIndex).filter((item) => !movable.has(item.id)),
    ...queueItems,
    ...items.slice(firstQueueIndex).filter((item) => !movable.has(item.id)),
  ];
  const active = activeId ? items.find((item) => item.key === activeId) ?? null : null;
  const brokerOf = (key: string) => items.find((item) => item.key === key)?.id ?? key;

  async function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    setOverId(null);
    if (!event.over) return;
    const movedId = brokerOf(String(event.active.id));
    const nextOrder = moveDutyTurn(current, movedId, brokerOf(String(event.over.id)));
    if (!nextOrder) return;
    const nextQueue = nextOrder.filter((id) => movable.has(id));
    setLocal({ source: signature, order: nextOrder, queue: nextQueue });
    setSaving(true);
    const result = await saveDutyManualQueueAction({ scheduleId, dutyDate, brokerIds: nextOrder });
    setSaving(false);
    if (!result.ok) {
      setLocal(null);
      toast.error(result.reason);
      return;
    }
    const moved = items.find((item) => item.id === movedId)?.name ?? "Corretor";
    toast.success(nextQueue[0] === movedId ? `${moved} é o próximo a receber.` : `${moved} agora é o ${nextQueue.indexOf(movedId) + 1}º na vez.`);
    router.refresh();
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event) => setActiveId(String(event.active.id))}
      onDragOver={(event) => setOverId(event.over && event.over.id !== event.active.id ? String(event.over.id) : null)}
      onDragCancel={() => { setActiveId(null); setOverId(null); }}
      onDragEnd={(event) => { void onDragEnd(event); }}
    >
      <SortableContext items={queueItems.map((item) => item.key)} strategy={() => null}>
        <div className={className}>
          {sorted.map((item) => <SortableCard key={item.key} item={item} movable={movable.has(item.id)} disabled={saving} isOver={overId === item.key} />)}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-primary bg-card px-3 py-2.5 text-sm font-medium">
            <GripVertical className="size-4 text-primary" aria-hidden="true" />
            {active.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

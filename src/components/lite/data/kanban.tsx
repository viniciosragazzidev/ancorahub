"use client";

/**
 * Kanban Lite (F3): colunas em --surface-muted, cartões brancos e a contagem de cada coluna. As colunas se reordenam
 * com o mouse (dnd-kit, a mesma ativação de 8px do kanban atual) e com o teclado pela alça da coluna: espaço pega,
 * setas movem, espaço solta e Esc cancela, com anúncios em pt-BR numa região aria-live.
 * O kanban não guarda ordem: avisa `onMoveColumn(ativa, alvo)` e quem usa decide (o mesmo `arrayMove` de hoje).
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, GripVertical } from "lucide-react";

import styles from "./kanban.module.css";

export type LiteKanbanColumn<T> = { id: string; title: string; items: T[] };

export type LiteKanbanProps<T> = {
  /** Nome da região (ex.: "Funil de leads em Kanban"). */
  label: string;
  columns: LiteKanbanColumn<T>[];
  itemKey: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  /** Coluna `activeId` vai para o lugar da coluna `overId` (mesma regra do arrastar com o mouse). */
  onMoveColumn: (activeId: string, overId: string) => void;
  /** Texto da coluna vazia. */
  emptyText?: ReactNode;
};

type Picked = { id: string; from: number; to: number };

const countLabel = (count: number) => (count === 1 ? "1 lead" : `${count} leads`);

export function LiteKanban<T>({ label, columns, itemKey, renderCard, onMoveColumn, emptyText = "Nenhum lead nesta etapa" }: LiteKanbanProps<T>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [dragging, setDragging] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const hintId = useId();
  const boardRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  // Como hoje: depois de rolar para o lado, aparece o atalho "Início" para voltar à primeira coluna.
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const check = () => setScrolled(board.scrollLeft > 20);
    board.addEventListener("scroll", check, { passive: true });
    return () => board.removeEventListener("scroll", check);
  }, []);
  const ids = columns.map((column) => column.id);
  const total = ids.length;
  const titleOf = useCallback((id: string) => columns.find((column) => column.id === id)?.title ?? id, [columns]);

  // Prévia do teclado: a coluna pega aparece no lugar de destino enquanto as setas a movem.
  const ordered = picked ? previewOrder(columns, picked) : columns;

  const focusHandle = (id: string) => window.setTimeout(() => handles.current.get(id)?.focus(), 0);

  const onHandleKey = (id: string) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = ids.indexOf(id);
    if (!picked) {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setPicked({ id, from: index, to: index });
        setAnnouncement(`Coluna ${titleOf(id)} pega, posição ${index + 1} de ${total}. Use as setas para mover, espaço para soltar e Esc para cancelar.`);
      }
      return;
    }
    if (picked.id !== id) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const to = event.key === "Home" ? 0
        : event.key === "End" ? total - 1
        : Math.min(total - 1, Math.max(0, picked.to + (event.key === "ArrowRight" ? 1 : -1)));
      setPicked({ ...picked, to });
      setAnnouncement(`Coluna ${titleOf(id)} na posição ${to + 1} de ${total}.`);
      focusHandle(id);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      setPicked(null);
      if (picked.to !== picked.from) onMoveColumn(id, ids[picked.to]!);
      setAnnouncement(`Coluna ${titleOf(id)} solta na posição ${picked.to + 1} de ${total}.`);
      focusHandle(id);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setPicked(null);
      setAnnouncement(`Movimento cancelado. Coluna ${titleOf(id)} voltou para a posição ${picked.from + 1}.`);
      focusHandle(id);
    } else if (event.key === "Tab") {
      setPicked(null);
      setAnnouncement(`Movimento cancelado. Coluna ${titleOf(id)} voltou para a posição ${picked.from + 1}.`);
    }
  };

  const onDragStart = (event: DragStartEvent) => {
    setPicked(null);
    setDragging(String(event.active.id));
    setAnnouncement(`Coluna ${titleOf(String(event.active.id))} pega.`);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setAnnouncement(`Coluna ${titleOf(String(active.id))} solta no mesmo lugar.`);
      return;
    }
    onMoveColumn(String(active.id), String(over.id));
    setAnnouncement(`Coluna ${titleOf(String(active.id))} solta na posição ${ids.indexOf(String(over.id)) + 1} de ${total}.`);
  };

  return (
    <div className={styles.root}>
      <p id={hintId} className={styles.srOnly}>Para mover uma coluna pelo teclado, foque a alça, aperte espaço, use as setas e aperte espaço de novo para soltar.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)} modifiers={[restrictToHorizontalAxis]} accessibility={{ announcements: silentAnnouncements, screenReaderInstructions: { draggable: "" } }}>
        <div ref={boardRef} role="region" aria-label={label} className={styles.board} data-lite="kanban">
          <SortableContext items={ordered.map((column) => column.id)} strategy={horizontalListSortingStrategy}>
            {ordered.map((column, position) => (
              <SortableColumn
                key={column.id}
                column={column}
                position={position}
                total={total}
                hintId={hintId}
                picked={picked?.id === column.id}
                dragging={dragging === column.id}
                handleRef={(node) => {
                  if (node) handles.current.set(column.id, node);
                  else handles.current.delete(column.id);
                }}
                onHandleKey={onHandleKey(column.id)}
                onHandleBlur={() => {
                  if (picked?.id === column.id) {
                    // O foco saiu da alça durante o movimento: cancela, como o Esc.
                    window.setTimeout(() => {
                      if (document.activeElement !== handles.current.get(column.id)) setPicked((current) => (current?.id === column.id ? null : current));
                    }, 0);
                  }
                }}
              >
                {column.items.length ? (
                  <ul className={styles.cards}>
                    {column.items.map((item) => (
                      <li key={itemKey(item)}>{renderCard(item)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.empty}>{emptyText}</p>
                )}
              </SortableColumn>
            ))}
          </SortableContext>
        </div>
      </DndContext>
      {scrolled ? (
        <button type="button" className={styles.toStart} onClick={() => boardRef.current?.scrollTo({ left: 0, behavior: "smooth" })}>
          <ArrowLeft aria-hidden="true" size={16} />
          Início
        </button>
      ) : null}
      <div aria-live="assertive" role="status" data-lite-announcer="" className={styles.srOnly}>{announcement}</div>
    </div>
  );
}

/** O kanban anuncia sozinho (pt-BR); o anúncio em inglês do dnd-kit fica mudo. */
const silentAnnouncements = {
  onDragStart: () => undefined,
  onDragMove: () => undefined,
  onDragOver: () => undefined,
  onDragEnd: () => undefined,
  onDragCancel: () => undefined,
};

function previewOrder<T>(columns: LiteKanbanColumn<T>[], picked: Picked) {
  const next = [...columns];
  const [moved] = next.splice(picked.from, 1);
  if (moved) next.splice(picked.to, 0, moved);
  return next;
}

function SortableColumn<T>({ column, position, total, hintId, picked, dragging, handleRef, onHandleKey, onHandleBlur, children }: {
  column: LiteKanbanColumn<T>;
  position: number;
  total: number;
  hintId: string;
  picked: boolean;
  dragging: boolean;
  handleRef: (node: HTMLButtonElement | null) => void;
  onHandleKey: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onHandleBlur: () => void;
  children: ReactNode;
}) {
  const { listeners, setNodeRef, transform, transition } = useSortable({ id: column.id });
  const titleId = useId();
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={titleId}
      className={styles.column}
      data-lifted={picked || dragging ? "true" : undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...listeners}
    >
      <header className={styles.head}>
        <button
          ref={handleRef}
          type="button"
          className={styles.handle}
          aria-label={`Mover coluna ${column.title}, posição ${position + 1} de ${total}`}
          aria-describedby={hintId}
          aria-pressed={picked}
          onKeyDown={onHandleKey}
          onBlur={onHandleBlur}
        >
          <GripVertical aria-hidden="true" size={16} />
        </button>
        <h2 id={titleId} className={styles.title}>{column.title}</h2>
        <span className={styles.count} aria-label={countLabel(column.items.length)}>{column.items.length}</span>
      </header>
      {children}
    </section>
  );
}

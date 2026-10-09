"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";

import { AssistantAvatar } from "./assistant-avatar";
import styles from "./dynamic-notice.module.css";
import type { MascotShape } from "./types";

export type DynamicNoticeItem = {
  id: string;
  /** Small line on top ("Leads", "Âncora"). */
  app: string;
  title: string;
  message: string;
  actionLabel: string;
  shape: MascotShape;
  hue: number | null;
};

/** How long a notice stays before leaving on its own (paused while pressed). */
export const NOTICE_DURATION_MS = 6000;
const DISMISS_DRAG_PX = -28;
const SPRING = { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.9 };

/**
 * iPhone-like notice: drops from the top as a black pill, opens into a card
 * with the assistant's mascot, the text and one action. Tap opens, drag up
 * dismisses, it leaves by itself after a few seconds. One at a time; the rest
 * wait in the queue (count shown on the card).
 */
export function DynamicNotice({
  item,
  queuedCount = 0,
  onOpen,
  onDismiss,
}: {
  item: DynamicNoticeItem | null;
  queuedCount?: number;
  onOpen: (item: DynamicNoticeItem) => void;
  onDismiss: (item: DynamicNoticeItem) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className={styles.layer}>
      <AnimatePresence mode="wait">
        {item ? <Notice key={item.id} item={item} queuedCount={queuedCount} reduce={Boolean(reduce)} onOpen={onOpen} onDismiss={onDismiss} /> : null}
      </AnimatePresence>
    </div>
  );
}

function Notice({ item, queuedCount, reduce, onOpen, onDismiss }: { item: DynamicNoticeItem; queuedCount: number; reduce: boolean; onOpen: (item: DynamicNoticeItem) => void; onDismiss: (item: DynamicNoticeItem) => void }) {
  const [held, setHeld] = useState(false);
  const [expanded, setExpanded] = useState(reduce);
  const remaining = useRef(NOTICE_DURATION_MS);
  const startedAt = useRef(0);
  const dragged = useRef(false);

  // The pill opens into the card right after it lands.
  useEffect(() => {
    if (reduce) return;
    const timer = setTimeout(() => setExpanded(true), 260);
    return () => clearTimeout(timer);
  }, [reduce]);

  // Leaves by itself; pressing (or hovering with a mouse) pauses the clock.
  useEffect(() => {
    if (held || !expanded) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => onDismiss(item), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (Date.now() - startedAt.current));
    };
  }, [expanded, held, item, onDismiss]);

  function onDragEnd(_event: unknown, info: PanInfo) {
    if (info.offset.y < DISMISS_DRAG_PX || info.velocity.y < -400) onDismiss(item);
    setTimeout(() => { dragged.current = false; }, 0);
  }

  // Numbers (not CSS functions) so the pill can morph into the card.
  const [cardWidth] = useState(() => (typeof window === "undefined" ? 420 : Math.min(420, window.innerWidth - 16)));
  const pill = { width: 126, height: 36, borderRadius: 20 };
  const card = { width: cardWidth, height: "auto", borderRadius: 28 };

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label={`${item.app}: ${item.title}. ${item.message}`}
      className={styles.notice}
      initial={reduce ? { opacity: 0 } : { y: -60, opacity: 0, ...pill }}
      animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1, ...(expanded ? card : pill) }}
      exit={reduce ? { opacity: 0 } : { y: -80, opacity: 0, scale: 0.96, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
      transition={SPRING}
      drag={reduce ? false : "y"}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.6, bottom: 0.08 }}
      onDragStart={() => { dragged.current = true; }}
      onDragEnd={onDragEnd}
      onPointerDown={() => setHeld(true)}
      onPointerUp={() => setHeld(false)}
      onPointerCancel={() => setHeld(false)}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onClick={() => { if (!dragged.current) onOpen(item); }}
    >
      <AnimatePresence>
        {expanded ? (
          <motion.div
            key="body"
            initial={reduce ? false : { opacity: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.2, delay: reduce ? 0 : 0.08 }}
          >
            <div className={styles.body}>
              <AssistantAvatar shape={item.shape} hue={item.hue} size={40} state="waiting" />
              <div className={styles.text}>
                <div className={styles.top}>
                  <span className={styles.app}>{item.app}</span>
                  <span className={styles.now}>agora</span>
                </div>
                <span className={styles.title}>{item.title}</span>
                <span className={styles.message}>{item.message}</span>
              </div>
              <button type="button" className={styles.action} onClick={(event) => { event.stopPropagation(); onOpen(item); }}>{item.actionLabel}</button>
            </div>
            {queuedCount > 0 ? <span className={styles.queued}>+{queuedCount}</span> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

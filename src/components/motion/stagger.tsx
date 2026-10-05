"use client";

import { motion } from "motion/react";
import { useRef, type ReactNode } from "react";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";

const MAX_STAGGER_ITEMS = 8;
const EXPO = [0.16, 1, 0.3, 1] as const;

type StaggerItemProps = {
  index: number;
  children: ReactNode;
  className?: string;
};

/**
 * Entrada curta (fade + 4px) só na primeira carga: stagger 40ms, máximo 8 itens.
 * Itens a partir do 8º aparecem sem animação.
 */
export function StaggerItem({ index, children, className }: StaggerItemProps) {
  const enabled = useInterfaceMotionEnabled();
  const animate = enabled && index < MAX_STAGGER_ITEMS;
  return (
    <motion.div
      className={className}
      initial={animate ? { opacity: 0, y: 4 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: animate ? index * 0.04 : 0, ease: EXPO }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Destaque para item novo (ex.: lead recém-chegado): overlay da primária a 8% que esmaece em 1,5s.
 * O pai precisa de `relative`. Anima só opacity.
 */
export function NewItemHighlight({ active }: { active: boolean }) {
  const enabled = useInterfaceMotionEnabled();
  if (!active || !enabled) return null;
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[inherit] bg-primary/10"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 1.5, ease: "easeOut" }}
    />
  );
}

/**
 * Ids que apareceram DEPOIS da primeira carga da lista (ex.: lead novo chegando por polling/refresh).
 * Use com <NewItemHighlight active={newIds.has(id)} />.
 */
export function useNewItemIds(ids: readonly string[]): ReadonlySet<string> {
  const known = useRef<Set<string> | null>(null);
  const fresh = useRef<Set<string>>(new Set());
  if (known.current === null) {
    known.current = new Set(ids);
  } else {
    for (const id of ids) {
      if (!known.current.has(id)) {
        known.current.add(id);
        fresh.current.add(id);
      }
    }
  }
  return fresh.current;
}

const animatedRows = new WeakSet<Element>();

/**
 * Entrada de linhas de tabela (<tr>) via Web Animations: só opacity/transform, uma vez por elemento,
 * stagger de 40ms nas 8 primeiras. Uso: `<TableRow ref={rowEnterRef(index)}>`.
 */
export function useRowEnter(): (index: number) => (el: HTMLElement | null) => void {
  const enabled = useInterfaceMotionEnabled();
  return (index) => (el) => {
    if (!el || !enabled || index >= MAX_STAGGER_ITEMS || animatedRows.has(el) || typeof el.animate !== "function") return;
    animatedRows.add(el);
    el.animate(
      [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 300, delay: index * 40, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "backwards" },
    );
  };
}

"use client";

/**
 * The motion kit of the director Lite (motion-e-acabamento.md, section 3), local to this preview.
 * Every value comes from arc/motion-tokens. With reduced motion (system or html[data-reduce-motion="1"]) only opacity moves.
 */
import { useRef, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useInView, useReducedMotion, type Transition } from "motion/react";

import { AnimatedCounter } from "@/components/arc/animated-counter/animated-counter";
import { motionTokens as m } from "@/components/arc/motion-tokens";

import styles from "../preview.module.css";

export const ease = {
  enter: [...m.ease.enter] as [number, number, number, number],
  exit: [...m.ease.exit] as [number, number, number, number],
  standard: [...m.ease.standard] as [number, number, number, number],
  inOut: [...m.ease.inOut] as [number, number, number, number],
};
export const enterT: Transition = { duration: m.duration.standard, ease: ease.enter };
export const exitT: Transition = { duration: m.duration.exit, ease: ease.exit };
export const fadeT: Transition = { duration: m.duration.instant };
/** Cascade: 35ms a step, 8 items at most (the 9th on enters with the 8th). */
export const staggerDelay = (index: number) => Math.min(index, 8) * m.stagger.item;

function subscribeAttr(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduce-motion"] });
  return () => observer.disconnect();
}

/** Reduced motion from the system or from the app's own accessibility preference. */
export function useReduce() {
  const system = useReducedMotion();
  const app = useSyncExternalStore(subscribeAttr, () => document.documentElement.dataset.reduceMotion === "1", () => false);
  return Boolean(system || app);
}

export function useMedia(query: string) {
  return useSyncExternalStore(
    (callback) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", callback);
      return () => list.removeEventListener("change", callback);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/* ------------------------------------------------------------------ numbers */

/** Odometer number in pt-BR. Counts up from zero the first time it is seen, then only animates the difference. */
export function LiteNumber({ value, kind = "int", decimals, className }: { value: number; kind?: "int" | "pct" | "brl" | "dec"; decimals?: number; className?: string }) {
  const places = decimals ?? (kind === "brl" ? 2 : kind === "dec" ? 1 : 0);
  return (
    <span className={`${styles.num} ${className ?? ""}`}>
      <AnimatedCounter value={value} locale="pt-BR" decimals={places} prefix={kind === "brl" ? "R$ " : ""} suffix={kind === "pct" ? "%" : ""} animateOnView />
    </span>
  );
}

/** A small pill that enters 80ms after the number it qualifies. */
export function LiteDelta({ children, tone = "warning", show = true }: { children: ReactNode; tone?: "warning" | "danger" | "success" | "neutral"; show?: boolean }) {
  const reduce = useReduce();
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.span
          className={styles.delta}
          data-tone={tone}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1, transition: { ...enterT, delay: reduce ? 0 : m.duration.instant * 0.66 } }}
          exit={{ opacity: 0, transition: fadeT }}
        >
          {children}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

/** One ring that fades out (600ms) to point at something that changed in real time. Never loops. */
export function LiteAttention({ pulse }: { pulse: number }) {
  const reduce = useReduce();
  if (!pulse) return null;
  return (
    <motion.span
      key={pulse}
      aria-hidden="true"
      className={styles.attention}
      initial={{ opacity: 1, scale: reduce ? 1 : 0.985 }}
      animate={{ opacity: 0, scale: reduce ? 1 : 1.015 }}
      transition={{ duration: m.duration.considered + m.duration.instant, ease: ease.standard }}
    />
  );
}

/* ------------------------------------------------------------------ entrances */

/** Enters once when it scrolls into view: fade and y 12px. */
export function LiteReveal({ children, className, delay = 0, as = "div", id, label }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "section"; id?: string; label?: string }) {
  const reduce = useReduce();
  const Component = as === "section" ? motion.section : motion.div;
  return (
    <Component
      id={id}
      aria-label={label}
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={reduce ? fadeT : { ...enterT, delay }}
    >
      {children}
    </Component>
  );
}

/** Cascade item (cards and rows): y 6px, 35ms a step, at most 8 steps. */
export function LiteItem({ children, index, className, as = "div" }: { children: ReactNode; index: number; className?: string; as?: "div" | "li" }) {
  const reduce = useReduce();
  const Component = as === "li" ? motion.li : motion.div;
  return (
    <Component
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? fadeT : { ...enterT, delay: staggerDelay(index) }}
    >
      {children}
    </Component>
  );
}

/** Content that changes in place (loading to ready, tab A to B): out with a 120ms fade, in with fade and y 4px. */
export function LiteSwap({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const reduce = useReduce();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        className={className}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0, transition: reduce ? fadeT : enterT }}
        exit={{ opacity: 0, transition: fadeT }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ charts */

/**
 * A bar that grows with scaleX from a fixed left origin (480ms) when it enters the view, and moves from the old value
 * to the new one when the data changes. The transform is a plain style with a CSS transition on the tokens, so the
 * size is right even when the app turns motion off; with reduced motion it jumps (no transition, see the CSS).
 */
export function LiteBar({ value, delay = 0, tone = "primary", className, height }: { value: number; delay?: number; tone?: string; className?: string; height?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReduce();
  const scale = Math.max(0, Math.min(1, value));
  const shown = reduce || inView ? scale : 0;
  return (
    <span ref={ref} className={`${styles.track} ${className ?? ""}`} style={height ? { height } : undefined} aria-hidden="true">
      <span className={styles.fill} data-tone={tone} style={{ transform: `scaleX(${shown})`, transitionDelay: `${delay}s` }} />
    </span>
  );
}

/** Vertical bar (hour charts): grows with scaleY from the base, 30ms cascade. */
export function LiteColumn({ value, delay = 0, tone = "primary", label }: { value: number; delay?: number; tone?: string; label?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduce = useReduce();
  return (
    <span ref={ref} className={styles.column} title={label}>
      <motion.span
        className={styles.columnFill}
        data-tone={tone}
        style={{ height: `${Math.max(2, Math.min(100, value * 100))}%` }}
        initial={reduce ? { opacity: 0 } : { scaleY: 0 }}
        animate={inView ? { opacity: 1, scaleY: 1 } : undefined}
        transition={reduce ? fadeT : { duration: m.duration.considered, ease: ease.standard, delay }}
      />
    </span>
  );
}

/* ------------------------------------------------------------------ tabs and segments */

type Option<T extends string | number> = { value: T; label: string; count?: number };

/** Pill tabs or segments: the active pill slides between options (layoutId + spring.morph). Arrow keys move. */
export function LitePills<T extends string | number>({
  options, value, onChange, label, group, kind = "segment", size = "md", controls, className,
}: {
  options: Option<T>[]; value: T; onChange: (value: T) => void; label: string; group: string;
  kind?: "tabs" | "segment"; size?: "md" | "sm"; controls?: string; className?: string;
}) {
  const reduce = useReduce();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + delta + options.length) % options.length;
    refs.current[next]?.focus();
    onChange(options[next].value);
  };
  return (
    <LayoutGroup id={group}>
      <div className={`${styles.pills} ${className ?? ""}`} data-size={size} role={kind === "tabs" ? "tablist" : "radiogroup"} aria-label={label}>
        {options.map((option, index) => {
          const active = option.value === value;
          return (
            <button
              key={String(option.value)}
              ref={(node) => { refs.current[index] = node; }}
              type="button"
              role={kind === "tabs" ? "tab" : "radio"}
              aria-selected={kind === "tabs" ? active : undefined}
              aria-checked={kind === "segment" ? active : undefined}
              aria-controls={kind === "tabs" ? controls : undefined}
              tabIndex={active ? 0 : -1}
              className={styles.pill}
              data-active={active}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKey(event, index)}
            >
              {active ? <motion.span layoutId={`${group}-pill`} className={styles.pillBg} transition={reduce ? { duration: 0 } : m.spring.morph} /> : null}
              <span className={styles.pillLabel}>
                {option.label}
                {option.count !== undefined ? <span className={styles.pillCount}>{option.count}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/** Press feedback for rows and cards (scale .99 or .985), none with reduced motion. */
export function LitePress({ children, className, kind = "row" }: { children: ReactNode; className?: string; kind?: "row" | "card" | "button" }) {
  const reduce = useReduce();
  const scale = kind === "button" ? 0.97 : kind === "card" ? 0.985 : 0.99;
  return (
    <motion.div className={className} whileTap={reduce ? undefined : { scale }} transition={m.spring.snappy}>
      {children}
    </motion.div>
  );
}

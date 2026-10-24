"use client";

/**
 * Floating layers of the preview: the side panel (desktop) that turns into the Arc BottomSheet on the phone,
 * and the pick menu (anchored popover on desktop, BottomSheet on the phone). Both carry the Lite scope,
 * because they render in a portal outside the page.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Check, ChevronDown, X } from "lucide-react";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { motionTokens as m } from "@/components/arc/motion-tokens";

import styles from "../preview.module.css";
import { ease, exitT, fadeT, useMedia, useReduce } from "./motion";

const SCOPE = `arc-venancor ${styles.tokens}`;

function useFocusReturn(open: boolean) {
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      trigger.current = document.activeElement as HTMLElement | null;
      return;
    }
    trigger.current?.focus?.();
  }, [open]);
}

/** Side panel on desktop (enters from the right, x 24px, spring.smooth; leaves in 180ms), BottomSheet below 768px. */
export function LiteLayer({ open, onClose, title, description, children, footer }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode }) {
  const desktop = useMedia("(min-width: 768px)");
  const reduce = useReduce();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useFocusReturn(open && desktop);

  useEffect(() => {
    if (!open || !desktop) return;
    const node = panel.current;
    node?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), select, input, [tabindex='0']")];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, desktop, onClose]);

  if (!desktop) {
    return (
      <BottomSheet open={open} onOpenChange={(next) => { if (!next) onClose(); }} title={title} description={description} detents={[0.62, 0.94]} closeLabel="Fechar" className={SCOPE}>
        <div className={styles.sheetBody}>
          {children}
          {footer ? <div className={styles.sheetFooter}>{footer}</div> : null}
        </div>
      </BottomSheet>
    );
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className={`${SCOPE} ${styles.layerRoot}`} key="layer">
          <motion.div className={styles.veil} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: m.duration.fast } }} exit={{ opacity: 0, transition: exitT }} />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={styles.panel}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0, transition: reduce ? fadeT : m.spring.smooth }}
            exit={{ opacity: 0, x: reduce ? 0 : 12, transition: exitT }}
          >
            <header className={styles.panelHeader}>
              <div className={styles.panelHeading}>
                <h2 id={titleId} className={styles.panelTitle}>{title}</h2>
                {description ? <p className={styles.panelDescription}>{description}</p> : null}
              </div>
              <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Fechar" data-autofocus>
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <div className={styles.panelBody}>{children}</div>
            {footer ? <footer className={styles.panelFooter}>{footer}</footer> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

type PickOption = { value: string; label: string; hint?: string };

/** Select of the Lite: anchored popover on desktop (opacity, scale .96 and y 4px in 160ms), BottomSheet on the phone. */
export function LitePick({ label, value, options, onChange, icon }: { label: string; value: string; options: PickOption[]; onChange: (value: string) => void; icon?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const desktop = useMedia("(min-width: 768px)");
  const reduce = useReduce();
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open || !desktop) return;
    const onDown = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); root.current?.querySelector<HTMLElement>("button")?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    root.current?.querySelector<HTMLElement>("[aria-selected='true']")?.focus();
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, desktop]);

  const choose = (next: string) => { onChange(next); setOpen(false); };
  const list = (
    <LayoutGroup id={listId}>
      <ul className={styles.menuList} role="listbox" aria-label={label} id={listId} onPointerLeave={() => setHover(null)}>
        {options.map((option) => {
          const selected = option.value === value;
          const lit = (hover ?? value) === option.value;
          return (
            <li key={option.value} role="presentation">
              <button type="button" role="option" aria-selected={selected} className={styles.menuItem} onClick={() => choose(option.value)} onPointerEnter={() => setHover(option.value)} onFocus={() => setHover(option.value)}>
                {lit ? <motion.span layoutId={`${listId}-lit`} className={styles.menuLit} transition={reduce ? { duration: 0 } : m.spring.morph} /> : null}
                <span className={styles.menuText}>
                  <span>{option.label}</span>
                  {option.hint ? <span className={styles.menuHint}>{option.hint}</span> : null}
                </span>
                {selected ? <Check aria-hidden="true" size={18} className={styles.menuCheck} /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </LayoutGroup>
  );

  return (
    <div className={styles.pick} ref={root}>
      <button type="button" className={styles.pickTrigger} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((was) => !was)} aria-label={`${label}: ${current.label}`}>
        {icon}
        <span className={styles.pickValue}>{current.label}</span>
        <ChevronDown aria-hidden="true" size={16} />
      </button>
      {desktop ? (
        <AnimatePresence>
          {open ? (
            <motion.div
              className={styles.popover}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: reduce ? fadeT : { duration: m.duration.fast, ease: ease.enter } }}
              exit={{ opacity: 0, transition: fadeT }}
            >
              {list}
            </motion.div>
          ) : null}
        </AnimatePresence>
      ) : (
        <BottomSheet open={open} onOpenChange={setOpen} title={label} closeLabel="Fechar" className={SCOPE}>
          <div className={styles.sheetBody}>{list}</div>
        </BottomSheet>
      )}
    </div>
  );
}

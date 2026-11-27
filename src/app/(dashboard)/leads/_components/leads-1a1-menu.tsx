"use client";

/**
 * Menu "⋯" da /leads no desenho 1:1 do artifact "Leads da gestão" (27/11/2026): botão redondo e painel branco com
 * itens em pílula. Fecha no clique fora, no Esc e ao escolher; o foco volta ao botão.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";

import styles from "../leads-1a1.module.css";

export type Leads1a1MenuItem = {
  id: string;
  label: string;
  href?: string;
  onSelect?: () => void;
  tone?: "danger" | "success";
  disabled?: boolean;
};

function Dots() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
  );
}

export function Leads1a1Menu({ label, items, variant = "round", trigger }: { label: string; items: Leads1a1MenuItem[]; variant?: "round" | "row"; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (!items.length) return null;
  const close = () => setOpen(false);
  return (
    <span ref={wrapRef} className={styles.menuWrap} onClick={(event) => event.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        className={variant === "row" ? styles.rowmenu : styles.iconbtn}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger ?? <Dots />}
      </button>
      {open ? (
        <div id={menuId} role="menu" aria-label={label} className={styles.menu}>
          {items.map((item) => item.href ? (
            <Link key={item.id} role="menuitem" className={styles.menuitem} data-tone={item.tone} href={item.href} onClick={close} {...(/^https?:/.test(item.href) ? { target: "_blank", rel: "noreferrer" } : {})}>{item.label}</Link>
          ) : (
            <button key={item.id} type="button" role="menuitem" className={styles.menuitem} data-tone={item.tone} disabled={item.disabled} onClick={() => { close(); item.onSelect?.(); }}>{item.label}</button>
          ))}
        </div>
      ) : null}
    </span>
  );
}

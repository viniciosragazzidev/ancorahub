"use client";

/**
 * Menu de ações Lite (F3): um botão de 44px com ícone que abre a lista de ações. Ações são botões ou links; Esc fecha
 * e devolve o foco ao disparador. Clicar numa ação fecha o menu.
 */
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

import styles from "./controls.module.css";

export type LiteMenuItem =
  | { id: string; label: string; onSelect: () => void; href?: undefined; tone?: "default" | "success" }
  | { id: string; label: string; href: string; onSelect?: undefined; tone?: "default" | "success" };

export function LiteMenu({ label, items }: { label: string; items: LiteMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    // O menu fica dentro de uma linha clicável: o clique e a tecla não podem abrir a linha junto.
    <div className={styles.menuWrap} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.menuTrigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal aria-hidden="true" size={18} />
      </button>
      {open ? (
        <ul id={menuId} role="menu" aria-label={label} className={styles.menuList}>
          {items.map((item) => (
            <li key={item.id} role="none">
              {item.href ? (
                <Link role="menuitem" href={item.href} className={styles.menuItem} data-tone={item.tone === "success" ? "success" : undefined} onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  data-tone={item.tone === "success" ? "success" : undefined}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

"use client";

/**
 * "Colunas" do Kanban no desenho 1:1 do artifact "Leads da gestão" (27/11/2026): pílula clara que abre o menu com
 * uma caixa por etapa. Mesmo estado de hoje (etapas ocultas guardadas pelo workspace).
 */
import { useEffect, useRef, useState } from "react";

import styles from "../leads-1a1.module.css";

export function LeadsColumnsMenu1a1({ columns, onToggle }: { columns: { id: string; label: string; visible: boolean }[]; onToggle: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <span ref={wrapRef} className={styles.menuWrap}>
      <button type="button" className={`${styles.pill} ${styles.pillQuiet} ${styles.pillQuietFlat}`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        Colunas
      </button>
      {open ? (
        <div className={styles.menu} role="group" aria-label="Colunas do Kanban">
          {columns.map((column) => (
            <label key={column.id} className={styles.menuitem}>
              <input type="checkbox" className={styles.checkInput} style={{ margin: 0 }} checked={column.visible} onChange={() => onToggle(column.id)} />
              {column.label}
            </label>
          ))}
        </div>
      ) : null}
    </span>
  );
}

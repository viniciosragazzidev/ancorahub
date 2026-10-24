"use client";

/**
 * Controles Lite de uso diário (F3, parte 2): chips de filtro, barra de lote e diálogo de confirmação.
 * Cada um tem a função de hoje; só muda o visual. Textos em pt-BR, sem travessão.
 */
import { useEffect, useId, useRef, type ReactNode } from "react";

import styles from "./controls.module.css";

export type FilterChip = { id: string; label: string; count?: number };

/** Chips de filtro em alternância (aria-pressed). Ativo com fundo de acento, nunca quebra linha. */
export function LiteFilterChips({ label, chips, active, onToggle }: { label: string; chips: FilterChip[]; active: string[]; onToggle: (id: string) => void }) {
  return (
    <div role="group" aria-label={label}>
      <ul className={styles.chips}>
        {chips.map((chip) => {
          const pressed = active.includes(chip.id);
          return (
            <li key={chip.id}>
              <button type="button" className={styles.chip} aria-pressed={pressed} onClick={() => onToggle(chip.id)}>
                {chip.label}
                {chip.count !== undefined ? <span>{" "}{chip.count}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type BulkAction = { id: string; label: string; onRun: () => void; tone?: "default" | "danger" };

/** Barra de lote: aparece com itens selecionados e leva as ações em massa. `count` 0 esconde a barra. */
export function LiteBulkBar({ count, actions, onClear }: { count: number; actions: BulkAction[]; onClear: () => void }) {
  if (count === 0) return null;
  const words = count === 1 ? "selecionado" : "selecionados";
  return (
    <div role="region" aria-label="Ações em lote" className={styles.bulk}>
      <span className={styles.bulkCount}>{count} {words}</span>
      <div className={styles.bulkActions}>
        {actions.map((action) => (
          <button key={action.id} type="button" className={styles.bulkButton} data-tone={action.tone === "danger" ? "danger" : undefined} onClick={action.onRun}>
            {action.label}
          </button>
        ))}
        <button type="button" className={styles.bulkButton} onClick={onClear}>Limpar seleção</button>
      </div>
    </div>
  );
}

/** Diálogo de confirmação: foco vai para "Cancelar", Esc cancela, e o foco volta ao disparador ao fechar. */
export function LiteConfirmDialog({ open, title, description, confirmLabel, cancelLabel = "Cancelar", tone = "primary", onConfirm, onCancel }: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      returnTo?.focus?.();
    };
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className={styles.scrim}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className={styles.dialog}>
        <h2 id={titleId} className={styles.dialogTitle}>{title}</h2>
        {description ? <div id={descriptionId} className={styles.dialogDescription}>{description}</div> : null}
        <div className={styles.dialogActions}>
          <button ref={cancelRef} type="button" className={styles.dialogButton} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={styles.dialogButton} data-tone={tone} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

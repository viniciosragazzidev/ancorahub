"use client";

/**
 * Controles Lite de uso diário (F3, parte 2): chips de filtro, barra de lote e diálogo de confirmação.
 * Cada um tem a função de hoje; só muda o visual. Textos em pt-BR, sem travessão.
 */
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

import styles from "./controls.module.css";

export { LiteMenu, type LiteMenuItem } from "./menu";
export { LiteSelect, useLitePhone, type LiteOption, type LiteSelectProps } from "./select";
export { LiteUrlSelect } from "./url-select";

export type FilterChip = { id: string; label: string; count?: number };
/** Filtro ativo: rótulo do campo e valor escolhido ("Filial" e "Centro"). */
export type ActiveFilterChip = { id: string; label: string; value: string };

type ToggleChipsProps = {
  label: string;
  chips: FilterChip[];
  active: string[];
  onToggle: (id: string) => void;
  /** Uma linha só, com rolagem lateral (para o celular), em vez de quebrar em várias linhas. */
  scroll?: boolean;
};

type RemovableChipsProps = {
  label: string;
  chips: ActiveFilterChip[];
  /** Com `onRemove`, cada chip mostra um filtro ativo e o clique remove esse filtro. */
  onRemove: (id: string) => void;
  scroll?: boolean;
};

/**
 * Chips de filtro. Em alternância (aria-pressed, ativo com fundo de acento) ou, com `onRemove`, como filtros ativos
 * removíveis ("Filial: Centro" com um X). Nunca quebram linha por dentro.
 */
export function LiteFilterChips(props: ToggleChipsProps | RemovableChipsProps) {
  const listClass = props.scroll ? `${styles.chips} ${styles.chipsScroll}` : styles.chips;
  if ("onRemove" in props) {
    const { label, chips, onRemove } = props;
    return (
      <div role="group" aria-label={label}>
        <ul className={listClass}>
          {chips.map((chip) => (
            <li key={chip.id}>
              <button type="button" className={`${styles.chip} ${styles.chipRemovable}`} aria-label={`Remover filtro ${chip.label}: ${chip.value}`} onClick={() => onRemove(chip.id)}>
                <span className={styles.chipKey}>{chip.label}</span>
                <span>{chip.value}</span>
                <X aria-hidden="true" size={14} className={styles.chipX} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const { label, chips, active, onToggle } = props;
  return (
    <div role="group" aria-label={label}>
      <ul className={listClass}>
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

export type BulkAction = {
  id: string;
  label: string;
  /** Rótulo curto para o celular (abaixo de 768px), para o botão não quebrar linha. */
  shortLabel?: string;
  onRun: () => void;
  tone?: "default" | "danger";
};

/** Barra de lote: aparece com itens selecionados e leva as ações em massa. `count` 0 esconde a barra. */
export function LiteBulkBar({ count, actions, onClear }: { count: number; actions: BulkAction[]; onClear: () => void }) {
  if (count === 0) return null;
  const words = count === 1 ? "selecionado" : "selecionados";
  return (
    <div role="region" aria-label="Ações em lote" className={styles.bulk}>
      <span className={styles.bulkCount}>{count} {words}</span>
      <div className={styles.bulkActions}>
        {actions.map((action) => (
          <button key={action.id} type="button" className={styles.bulkButton} data-tone={action.tone === "danger" ? "danger" : undefined} aria-label={action.shortLabel ? action.label : undefined} onClick={action.onRun}>
            {action.shortLabel ? (
              <>
                <span className={styles.longLabel}>{action.label}</span>
                <span className={styles.shortLabel} aria-hidden="true">{action.shortLabel}</span>
              </>
            ) : action.label}
          </button>
        ))}
        <button type="button" className={styles.bulkButton} aria-label="Limpar seleção" onClick={onClear}>
          <span className={styles.longLabel}>Limpar seleção</span>
          <span className={styles.shortLabel} aria-hidden="true">Limpar</span>
        </button>
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

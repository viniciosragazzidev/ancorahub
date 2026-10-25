"use client";

/**
 * Paginação Lite (F3): "1 a 20 de 134", anterior e próxima com 44px. No celular fica só "Página 2 de 7" com as setas.
 * Não navega sozinha: avisa `onPageChange` e quem usa leva a página para a URL.
 */
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import styles from "./pagination.module.css";

export function LitePagination({ page, totalPages, totalItems, pageSize, onPageChange, pending = false, label = "Paginação" }: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  pending?: boolean;
  label?: string;
}) {
  if (totalPages <= 1) return null;
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const go = (target: number) => {
    if (target < 1 || target > totalPages || target === page || pending) return;
    onPageChange(target);
  };
  return (
    <nav aria-label={label} className={styles.root} data-pending={pending ? "true" : undefined}>
      <p className={styles.range} aria-live="polite">
        <span className={styles.long}>{start} a {end} de {totalItems}</span>
        <span className={styles.short}>Página {page} de {totalPages}</span>
      </p>
      <div className={styles.buttons}>
        <button type="button" className={styles.button} aria-label="Página anterior" disabled={page <= 1 || pending} onClick={() => go(page - 1)}>
          <ChevronLeft aria-hidden="true" size={18} />
        </button>
        <span className={`${styles.current} ${styles.long}`} aria-current="page">Página {page} de {totalPages}</span>
        <button type="button" className={styles.button} aria-label="Próxima página" disabled={page >= totalPages || pending} onClick={() => go(page + 1)}>
          <ChevronRight aria-hidden="true" size={18} />
        </button>
      </div>
    </nav>
  );
}

/** Páginas no cliente para listas que já chegam inteiras: devolve a fatia da página e as props da LitePagination. */
export function useLitePages<T>(rows: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, totalPages);
  return {
    pageRows: rows.slice((current - 1) * pageSize, current * pageSize),
    pagination: { page: current, totalPages, totalItems: rows.length, pageSize, onPageChange: setPage },
    reset: () => setPage(1),
  };
}

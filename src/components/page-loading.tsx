import { cn } from "@/lib/utils";

import styles from "./page-loading.module.css";

/**
 * Carregamento de página inteira: anel animado na cor do tema e o texto pequeno embaixo,
 * centralizados na área útil (entre o topo e a barra de abas do Lite). Só aparece depois de
 * ~200ms para não piscar em navegação rápida. Com movimento reduzido (sistema ou chave
 * html[data-interface-motion="off"]) o indicador fica parado.
 */
export function PageLoading({ label = "Carregando…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn(styles.root, className)} role="status" aria-live="polite" data-slot="page-loading">
      <div className={styles.content}>
        <span className={styles.indicator} aria-hidden="true" data-testid="page-loading-indicator">
          <span className={styles.ring} />
          <span className={styles.core} />
        </span>
        <p className={styles.label}>{label}</p>
      </div>
    </div>
  );
}

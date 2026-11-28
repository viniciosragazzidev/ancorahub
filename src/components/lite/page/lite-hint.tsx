/**
 * Dica "?" da direção limpa (28/11/2026): o texto explicativo que ficava fixo sob o título passa a aparecer ao passar
 * o mouse ou focar com o teclado. Sem estado e sem "use client": serve em página do servidor e do cliente.
 */
import styles from "./lite-hint.module.css";

export function LiteHint({ text, label = "O que é isto" }: { text: string; label?: string }) {
  return (
    <span className={styles.hint} tabIndex={0} role="note" aria-label={`${label}: ${text}`}>
      <span aria-hidden="true">?</span>
      <span className={styles.bubble} aria-hidden="true">{text}</span>
    </span>
  );
}

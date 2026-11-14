"use client";

/**
 * "Leads aguardando corretor" dentro do Resumo (14/11/2026): a antiga aba Operação saiu e a caixa de atribuição
 * manual mora aqui, recolhida numa linha com a contagem. Abre ao tocar, ou sozinha quando o link traz
 * `?atribuir=1` (os atalhos "Atribuir →" e "Fila →" do painel ao vivo), e rola até ela.
 */
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, UserPlus } from "lucide-react";

import styles from "./assign-section.module.css";

export function AssignSection({ count, children }: { count: number; children: ReactNode }) {
  const requested = useSearchParams()?.get("atribuir") === "1";
  const [open, setOpen] = useState(requested);
  const ref = useRef<HTMLElement>(null);
  const bodyId = useId();

  useEffect(() => {
    if (!requested) return;
    setOpen(true);
    ref.current?.scrollIntoView({ block: "start" });
  }, [requested]);

  return (
    <section ref={ref} id="atribuir" className={styles.root} data-open={open ? "true" : undefined} aria-label="Leads aguardando corretor">
      <button type="button" className={styles.head} aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((value) => !value)}>
        <span className={styles.icon} aria-hidden="true"><UserPlus size={16} /></span>
        <span className={styles.text}>
          <span className={styles.title}>Leads aguardando corretor</span>
          <span className={styles.hint}>Atribua à mão o que a distribuição automática não entregou.</span>
        </span>
        <span className={styles.count} data-zero={count === 0 ? "true" : undefined}>{count.toLocaleString("pt-BR")}</span>
        <ChevronDown size={18} aria-hidden="true" className={styles.chevron} />
      </button>
      {open ? <div id={bodyId} className={styles.body}>{children}</div> : null}
    </section>
  );
}

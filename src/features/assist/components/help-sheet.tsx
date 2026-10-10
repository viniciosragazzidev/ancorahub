"use client";

import Link from "next/link";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";

import { helpForRoute } from "../catalog";
import styles from "./assist.module.css";

/**
 * "?" of each Lite screen: what this screen is, in 3 steps, plus where to go
 * next. A screen without help shows the search instead (never a dead end).
 */
export function HelpSheet({ pathname, open, onOpenChange, onSearch }: { pathname: string; open: boolean; onOpenChange: (open: boolean) => void; onSearch: () => void }) {
  const help = helpForRoute(pathname);
  return (
    <BottomSheet className="arc-venancor" open={open} onOpenChange={onOpenChange} title={help ? `Ajuda: ${help.title}` : "Ajuda"} description={help?.intro} detents={[0.62, 0.92]} closeLabel="Fechar">
      <div className={styles.help}>
        {help ? (
          <ol className={styles.steps}>
            {help.steps.map((step, index) => (
              <li key={step}><span className={styles.stepNumber} aria-hidden="true">{index + 1}</span><span>{step}</span></li>
            ))}
          </ol>
        ) : <p className={styles.helpEmpty}>Ainda não temos um passo a passo desta tela. A busca acha qualquer coisa do app.</p>}

        {help?.related.length ? (
          <nav aria-label="Relacionados" className={styles.related}>
            {help.related.map((item) => (
              <Link key={item.href} href={item.href} className={styles.relatedLink} onClick={() => onOpenChange(false)}>
                <span>{item.label}</span>
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
            ))}
          </nav>
        ) : null}

        <button type="button" className={styles.searchCta} onClick={() => { onOpenChange(false); onSearch(); }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          Procurar outra coisa
        </button>
      </div>
    </BottomSheet>
  );
}

/** The round "?" button for the Lite header (44px target). */
export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.helpButton} onClick={onClick} aria-label="Ajuda desta tela">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.3M12 17h.01" /></svg>
    </button>
  );
}

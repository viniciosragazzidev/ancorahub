"use client";

import { useState, type ReactNode } from "react";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";

import { GLOSSARY, type GlossaryKey } from "../glossary";
import styles from "./term.module.css";

/**
 * A word of the broker's day with its meaning one tap away (E7): dotted
 * underline, opens a short sheet with what it is and why it matters.
 * `children` is the word as written in the sentence.
 */
export function Term({ id, children }: { id: GlossaryKey; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const entry = GLOSSARY[id];
  return (
    <>
      <button type="button" className={styles.term} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${typeof children === "string" ? children : entry.term}: o que é`}>
        {children}
      </button>
      <BottomSheet className="arc-venancor" open={open} onOpenChange={setOpen} title={entry.term} detents={[0.42]} closeLabel="Fechar">
        <div className={styles.sheet}>
          <p className={styles.meaning}>{entry.meaning}</p>
          <p className={styles.why}><strong>Por que importa:</strong> {entry.why}</p>
        </div>
      </BottomSheet>
    </>
  );
}

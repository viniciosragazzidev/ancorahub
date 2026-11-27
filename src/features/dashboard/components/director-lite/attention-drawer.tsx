"use client";

/**
 * "Precisa de você" (27/11/2026, cópia 1:1 do artifact): pílula azul com a contagem que abre a gaveta (lateral no
 * computador, de baixo no celular). Os itens são os mesmos de `attentionItems`.
 */
import { useState } from "react";
import Link from "next/link";

import { LiteSidePanel } from "@/components/lite/data/side-panel";

import type { AttentionItem } from "./attention";
import styles from "./painel.module.css";

const TONE_LABEL: Record<AttentionItem["tone"], string> = { danger: "Urgente", warning: "Atenção", neutral: "Acompanhar" };

export function AttentionDrawerButton({ items }: { items: AttentionItem[] }) {
  const [open, setOpen] = useState(false);
  const calm = items.length === 0;
  return (
    <>
      <button type="button" className={`${styles.pill} ${styles.pillPrimary}`} data-calm={calm ? "true" : undefined} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <span className={`${styles.orb} ${calm ? "" : styles.working}`} aria-hidden="true" />
        {calm ? "Tudo em dia" : "Precisa de você"}
        {calm ? null : <span className={`${styles.pillCount} ${styles.num}`}>{items.length}</span>}
      </button>
      <LiteSidePanel open={open} onOpenChange={setOpen} title="Precisa de você agora" description={calm ? "Nada pedindo decisão agora." : "Do mais urgente ao que dá para acompanhar."}>
        <div className={styles.gx} style={{ background: "transparent", minHeight: 0 }}>
          {calm ? (
            <p className={styles.allClear}>Tudo em dia. Nada pedindo decisão agora.</p>
          ) : (
            <ul className={styles.drawerList}>
              {items.map((item, index) => (
                <li key={item.id} className={`${styles.drawerItem} ${styles.in}`} style={{ animationDelay: `${index * 40}ms` }}>
                  <span className={styles.tag} data-tone={item.tone}>{TONE_LABEL[item.tone]}</span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span className={styles.itemTitle}>{item.title}</span>
                    <span className={`${styles.itemDetail} ${styles.num}`}>{item.detail}</span>
                  </span>
                  <Link href={item.href} className={`${styles.pill} ${index === 0 ? styles.pillPrimary : styles.pillQuiet}`} style={{ alignSelf: "flex-start" }} onClick={() => setOpen(false)}>
                    {item.action}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </LiteSidePanel>
    </>
  );
}

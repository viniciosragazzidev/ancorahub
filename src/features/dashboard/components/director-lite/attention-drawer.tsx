"use client";

/**
 * "Precisa de você" (27/11/2026): o que pede decisão saiu do meio do painel e virou um botão no topo, com a contagem,
 * que abre uma gaveta (lateral no computador, de baixo no celular). Os itens são os mesmos de `attentionItems`.
 */
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";

import { LiteSidePanel } from "@/components/lite/data/side-panel";

import type { AttentionItem } from "./attention";
import styles from "./director-lite.module.css";
import local from "./operation-view.module.css";

const TONE_LABEL: Record<AttentionItem["tone"], string> = { danger: "Urgente", warning: "Atenção", neutral: "Acompanhar" };

export function AttentionDrawerButton({ items }: { items: AttentionItem[] }) {
  const [open, setOpen] = useState(false);
  const calm = items.length === 0;
  return (
    <>
      <button type="button" className={styles.attentionButton} data-calm={calm ? "true" : undefined} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        {/* No celular (27/11/2026) fica só a bolinha azul com o número; o texto segue para o leitor de tela. */}
        <span className={styles.attentionLabel}>{calm ? "Tudo em dia" : "Precisa de você"}</span>
        {calm ? null : <span className={styles.attentionCount}>{items.length}</span>}
      </button>
      <LiteSidePanel open={open} onOpenChange={setOpen} title="Precisa de você agora" description={calm ? "Nada pedindo decisão agora." : "Do mais urgente ao que dá para acompanhar."}>
        {calm ? (
          <p className={local.allClear}>
            <CheckCircle2 aria-hidden="true" size={16} />
            Tudo em dia. Nada pedindo decisão agora.
          </p>
        ) : (
          <ul className={local.drawerList}>
            {items.map((item, index) => (
              <li key={item.id} className={local.drawerItem}>
                <span className={local.toneTag} data-tone={item.tone}>{TONE_LABEL[item.tone]}</span>
                <p className={local.attentionTitle}>{item.title}</p>
                <p className={local.attentionDetail}>{item.detail}</p>
                <Link href={item.href} className={local.drawerAction} data-primary={index === 0 ? "true" : undefined} onClick={() => setOpen(false)}>
                  {item.action}
                  <ArrowUpRight aria-hidden="true" size={14} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </LiteSidePanel>
    </>
  );
}

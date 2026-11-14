"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Calculator, CalendarDays, HandCoins, UserPlus, type LucideIcon } from "lucide-react";

import css from "./home-quick-actions.module.css";

export type HomeQuickAction = {
  id: "venda" | "contato" | "cotacao" | "agenda";
  label: string;
  icon: LucideIcon;
  /** Link de destino; quando há onSelect, o toque abre o painel no próprio Início. */
  href?: string;
  onSelect?: () => void;
};

/**
 * Ações rápidas do Início do corretor (chave BROKER_HOME_ACTIONS): sempre no mesmo lugar, na mesma ordem.
 * Registrar venda, Novo contato, Cotação (quando o simulador está liberado) e Minha agenda.
 */
export function homeQuickActions({ canQuote, onQuickSale }: { canQuote: boolean; onQuickSale?: () => void }): HomeQuickAction[] {
  return [
    { id: "venda", label: "Registrar venda", icon: HandCoins, ...(onQuickSale ? { onSelect: onQuickSale } : { href: "/leads?tab=minha-fila" }) },
    { id: "contato", label: "Novo contato", icon: UserPlus, href: "/clientes?adicionar=1" },
    ...(canQuote ? [{ id: "cotacao" as const, label: "Cotação", icon: Calculator, href: "/cotacao" }] : []),
    { id: "agenda", label: "Minha agenda", icon: CalendarDays, href: "/agenda" },
  ];
}

export function HomeQuickActions({ actions, className, after }: { actions: HomeQuickAction[]; className?: string; after?: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <section className={`${css.root} ${className ?? ""}`} aria-labelledby="home-quick-actions-title" data-tour="home-quick-actions">
      <h2 id="home-quick-actions-title" className={css.title}>Ações rápidas</h2>
      <ul className={css.grid} data-count={actions.length}>
        {actions.map((action, index) => {
          const Icon = action.icon;
          const content = (
            <>
              <span className={css.icon} aria-hidden="true"><Icon strokeWidth={1.9} /></span>
              <span className={css.label}>{action.label}</span>
            </>
          );
          return (
            <motion.li
              key={action.id}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: reduce ? 0 : index * 0.04, ease: [0.16, 1, 0.3, 1] }}
            >
              {action.onSelect ? (
                <button type="button" className={css.action} onClick={action.onSelect}>{content}</button>
              ) : (
                <Link href={action.href ?? "/dashboard"} className={css.action}>{content}</Link>
              )}
            </motion.li>
          );
        })}
      </ul>
      {after}
    </section>
  );
}

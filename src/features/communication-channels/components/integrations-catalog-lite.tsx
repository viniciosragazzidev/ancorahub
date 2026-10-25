/**
 * Catálogo de integrações no visual Lite: os mesmos itens e destinos do catálogo atual, em grade de cartões de mesma
 * altura (borda de 1px, sem sombra), ícones lucide e o status em texto. "Em breve" fica sem link, como hoje.
 */
import Link from "next/link";
import { ArrowRight, Globe, Link2, MessageCircle, Plug, type LucideIcon } from "lucide-react";

import page from "@/components/lite/page/lite-page.module.css";

import { integrationCatalogEntries } from "./integrations-catalog";
import styles from "./integrations-catalog-lite.module.css";

const ICONS: Record<string, LucideIcon> = { "Meta Business": Globe, WhatsApp: MessageCircle, "Formulários e site": Link2, Instagram: Globe };

export function IntegrationsCatalogLite() {
  return (
    <section aria-labelledby="integrations-catalog-title" className={page.group}>
      <header className={page.cardHead}>
        <h2 id="integrations-catalog-title" className={page.cardTitle}>Canais da operação</h2>
        <p className={page.cardDescription}>Cada integração abre uma área própria de configuração e acompanhamento.</p>
      </header>
      <ul className={styles.grid}>
        {integrationCatalogEntries.map((integration) => {
          const Icon = ICONS[integration.name] ?? Plug;
          const available = integration.status === "available";
          const body = (
            <>
              <span className={styles.top}>
                <Icon aria-hidden="true" size={20} strokeWidth={1.75} className={styles.icon} />
                <span className={page.badge} data-tone={available ? "success" : undefined}>{available ? "Disponível" : "Em breve"}</span>
              </span>
              <span className={styles.name}>{integration.name}</span>
              <span className={styles.description}>{integration.description}</span>
              {available ? <span className={styles.open}>Abrir <ArrowRight aria-hidden="true" size={16} /></span> : null}
            </>
          );
          return (
            <li key={integration.name} className={styles.item}>
              {integration.href ? (
                <Link href={integration.href} className={styles.card} aria-label={`Abrir integração ${integration.name}`}>{body}</Link>
              ) : (
                <div className={styles.card} data-planned="true" aria-disabled="true">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

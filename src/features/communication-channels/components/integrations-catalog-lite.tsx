"use client";

/**
 * Catálogo de integrações no visual Lite (20/11/2026, ref P17 do Jubayer e skill interface-enxuta): abas com contagem
 * (Todas, Recebendo, Sem leads, Em breve) e, em cada cartão, a saúde real do canal: se está recebendo leads, quando
 * chegou o último e quantos nas últimas 24 h. "Em breve" fica sem link, como antes.
 */
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Globe, Link2, MessageCircle, Plug, type LucideIcon } from "lucide-react";

import page from "@/components/lite/page/lite-page.module.css";

import type { IntegrationHealth, IntegrationKey } from "../integration-health-core";
import { integrationCatalogEntries } from "./integrations-catalog";
import styles from "./integrations-catalog-lite.module.css";

const ICONS: Record<string, LucideIcon> = { "Meta Business": Globe, WhatsApp: MessageCircle, "Formulários e site": Link2, Instagram: Globe };
const HEALTH_KEY: Record<string, IntegrationKey> = { "Meta Business": "meta", WhatsApp: "whatsapp", "Formulários e site": "forms" };
const TONE: Record<IntegrationHealth["state"], string | undefined> = { receiving: "success", quiet: "warning", silent: undefined };

type Tab = "all" | "receiving" | "quiet" | "planned";

export function IntegrationsCatalogLite({ health }: { health?: Partial<Record<IntegrationKey, IntegrationHealth>> }) {
  const [tab, setTab] = useState<Tab>("all");
  const entries = integrationCatalogEntries.map((integration) => ({
    integration,
    health: integration.status === "available" ? health?.[HEALTH_KEY[integration.name] ?? "forms"] ?? null : null,
  }));
  const matches = (entry: (typeof entries)[number], value: Tab) =>
    value === "all"
    || (value === "planned" && entry.integration.status === "planned")
    || (value === "receiving" && entry.health?.state === "receiving")
    || (value === "quiet" && entry.integration.status === "available" && entry.health !== null && entry.health.state !== "receiving");
  const tabs: Array<{ value: Tab; label: string }> = [
    { value: "all", label: "Todas" },
    { value: "receiving", label: "Recebendo" },
    { value: "quiet", label: "Sem leads" },
    { value: "planned", label: "Em breve" },
  ];
  const visible = entries.filter((entry) => matches(entry, tab));

  return (
    <section aria-labelledby="integrations-catalog-title" className={page.group}>
      <header className={styles.head}>
        <h2 id="integrations-catalog-title" className={page.cardTitle}>Canais da operação</h2>
        <nav aria-label="Filtrar integrações" className={styles.tabs}>
          {tabs.map((item) => {
            const count = entries.filter((entry) => matches(entry, item.value)).length;
            return (
              <button key={item.value} type="button" className={styles.tab} data-active={tab === item.value ? "true" : undefined} aria-pressed={tab === item.value} onClick={() => setTab(item.value)}>
                {item.label}
                <span className={styles.tabCount}>{count}</span>
              </button>
            );
          })}
        </nav>
      </header>
      {visible.length ? (
        <ul className={styles.grid}>
          {visible.map(({ integration, health: status }) => {
            const Icon = ICONS[integration.name] ?? Plug;
            const available = integration.status === "available";
            const body = (
              <>
                <span className={styles.top}>
                  <Icon aria-hidden="true" size={20} strokeWidth={1.75} className={styles.icon} />
                  <span className={page.badge} data-tone={available ? (status ? TONE[status.state] : "success") : undefined}>
                    {available ? (status?.label ?? "Disponível") : "Em breve"}
                  </span>
                </span>
                <span className={styles.name}>{integration.name}</span>
                <span className={styles.description}>{integration.description}</span>
                {available ? (
                  <span className={styles.foot}>
                    <span className={styles.footText}>{status?.detail ?? "Configure para começar a receber."}</span>
                    <span className={styles.open}>Abrir <ArrowRight aria-hidden="true" size={16} /></span>
                  </span>
                ) : null}
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
      ) : (
        <p className={styles.description}>Nenhuma integração nesta aba.</p>
      )}
    </section>
  );
}

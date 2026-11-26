"use client";

/**
 * "Recursos" no visual Lite (25/11): tudo o que liga e desliga para a corretora, só leitura, agrupado em Da
 * plataforma, Da empresa e Por unidade. Cada linha diz o que o recurso faz, quem decide e a situação em texto.
 * "Ajustar" só aparece no que o diretor já pode mudar, levando à seção certa. Nunca mostra valor salvo nem chave.
 */
import Link from "next/link";

import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import page from "@/components/lite/page/lite-page.module.css";
import styles from "@/components/lite/page/lite-sections.module.css";
import { resourceStateLabel, type ResourceEntry, type ResourceGroup } from "@/features/system-settings/resource-catalog";

function columnsFor(group: ResourceGroup): LiteColumn<ResourceEntry>[] {
  const adjustable = group.items.some((item) => item.adjustHref);
  return [
    {
      id: "title",
      label: "Recurso",
      primary: true,
      render: (item) => (
        <span>
          <span className={page.cellTitle}>{item.title}</span>
          <span className={page.cellSub}>{item.detail}</span>
        </span>
      ),
    },
    ...(group.id === "unidade" ? [{ id: "unit", label: "Unidade", secondary: true, nowrap: true, render: (item: ResourceEntry) => item.unitName ?? "" }] : []),
    { id: "decidedBy", label: "Quem decide", nowrap: true, render: (item) => <span className={page.muted}>{item.decidedBy}</span> },
    {
      id: "state",
      label: "Situação",
      nowrap: true,
      phonePriority: "high",
      render: (item) => <span className={page.badge} data-tone={item.enabled ? "success" : undefined}>{resourceStateLabel(item.enabled)}</span>,
    },
    ...(adjustable ? [{
      id: "actions",
      label: "Ajuste",
      nowrap: true,
      render: (item: ResourceEntry) => (item.adjustHref ? <Link href={item.adjustHref} className={page.button} aria-label={`Ajustar ${item.title}`}>Ajustar</Link> : null),
    }] : []),
  ];
}

export function ResourcesLite({ groups }: { groups: ResourceGroup[] }) {
  if (!groups.length) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Nenhum recurso para mostrar</p>
      </div>
    );
  }
  return (
    <>
      {groups.map((group) => {
        const on = group.items.filter((item) => item.enabled).length;
        return (
          <section key={group.id} className={styles.group} aria-labelledby={`resources-${group.id}-title`}>
            <div className={styles.row}>
              <div className={styles.rowText}>
                <h3 id={`resources-${group.id}-title`} className={styles.rowTitle}>{group.title}</h3>
                <p className={styles.rowDescription}><span className="tabular-nums">{on}</span> de <span className="tabular-nums">{group.items.length}</span> ligados</p>
              </div>
            </div>
            <LiteResponsiveData
              caption={`Recursos ${group.title.toLowerCase()}`}
              columns={columnsFor(group)}
              rows={group.items}
              rowKey={(item) => item.id}
              empty={<p className={page.emptyText}>Nenhum recurso neste grupo.</p>}
            />
          </section>
        );
      })}
    </>
  );
}

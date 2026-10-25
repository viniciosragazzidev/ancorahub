/**
 * Visão geral de um domínio (conversas, equipe, vendas) no visual Lite do diretor: a mesma descrição, os mesmos
 * números e o mesmo atalho para a operação. O título fica no topo da moldura, sem repetir no corpo.
 */
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import page from "@/components/lite/page/lite-page.module.css";

import type { DomainDashboard } from "../../service";

export function DomainDashboardLite({ data }: { data: DomainDashboard }) {
  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <p className={page.cardDescription}>{data.description}</p>
      <section className={page.stats} aria-label={`Indicadores de ${data.title.toLocaleLowerCase("pt-BR")}`}>
        {data.metrics.map((metric) => (
          <div key={metric.label} className={page.stat}>
            <span className={page.statLabel}>{metric.label}</span>
            <span className={page.statValue}>{metric.value}</span>
          </div>
        ))}
      </section>
      <div>
        <Link href={data.actionHref} className={page.button}>Abrir operação <ArrowUpRight aria-hidden="true" size={16} /></Link>
      </div>
    </div>
  );
}

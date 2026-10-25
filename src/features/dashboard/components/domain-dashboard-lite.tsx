/**
 * Visão de domínio no visual Lite (ex.: /tarefas/dashboard). O título já está no cabeçalho do app, então aqui não há
 * h1 repetido: uma linha de apoio, o atalho para a operação e os números em cartões de borda fina.
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { StatCard } from "@/components/dashboard/metric-card";
import page from "@/components/lite/page/lite-page.module.css";

import type { DomainDashboard } from "../service";

export function DomainDashboardLite({ data, actionLabel = "Abrir operação" }: { data: DomainDashboard; actionLabel?: string }) {
  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <section className={page.group} aria-label={data.title}>
        <div className={page.toolbar}>
          <p className={page.muted}>{data.description}</p>
          <Link href={data.actionHref} className={`${page.button} ${page.toolbarEnd}`}>
            {actionLabel} <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <div className={page.stats}>
          {data.metrics.map((metric, index) => (
            <StatCard key={metric.label} label={metric.label} value={metric.value} animated animationDelay={index * 0.06} />
          ))}
        </div>
      </section>
    </div>
  );
}

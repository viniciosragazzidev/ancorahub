import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { DomainDashboard } from "@/features/dashboard/service";
import styles from "./director-distribution-dashboard.module.css";

const number = new Intl.NumberFormat("pt-BR");

export function DirectorDistributionDashboard({ data }: { data: DomainDashboard }) {
  return (
    <div className={styles.content}>
      <p className={styles.description}>{data.description}</p>
      <section className={styles.metrics} aria-label="Indicadores da distribuição">
        {data.metrics.map((metric) => (
          <article key={metric.label} className={styles.metric}>
            <h2>{metric.label}</h2>
            <p>{typeof metric.value === "number" ? number.format(metric.value) : metric.value}</p>
          </article>
        ))}
      </section>
      <Link className={styles.action} href="/distribuicao?view=resumo_dia">
        Abrir distribuição <ArrowUpRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}

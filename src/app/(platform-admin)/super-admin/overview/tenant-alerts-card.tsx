"use client";

/**
 * Bloco "Alertas por empresa" da visão geral (26/11): tabela Lite, uma linha por empresa, clique abre a empresa.
 * Números com tabular-nums; sem número quando não deu para contar.
 */
import { useRouter } from "next/navigation";

import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import page from "@/components/lite/page/lite-page.module.css";
import { tenantAdminHref, type TenantAlertRow } from "@/features/platform-admin/tenant-alerts-core";

function amount(value: number | null) {
  return value === null ? "Sem dado" : value.toLocaleString("pt-BR");
}

export function TenantAlertsCard({ rows, questionsReady }: { rows: TenantAlertRow[]; questionsReady: boolean }) {
  const router = useRouter();
  const columns: LiteColumn<TenantAlertRow>[] = [
    { id: "empresa", label: "Empresa", primary: true, render: (row) => row.name },
    { id: "situacao", label: "Situação", secondary: true, render: (row) => (row.active ? "Ativa" : "Inativa") },
    { id: "alertas", label: "Alertas da IA", numeric: true, render: (row) => amount(row.openAlerts) },
    { id: "perguntas", label: "Perguntas para a direção", numeric: true, render: (row) => (questionsReady ? amount(row.openQuestions) : "Sem dado") },
  ];
  return (
    <section className={`arc-venancor ${page.card}`} aria-labelledby="alertas-por-empresa">
      <div className={page.cardHead}>
        <h2 id="alertas-por-empresa" className={page.cardTitle}>Alertas por empresa</h2>
        <p className={page.cardDescription}>
          {questionsReady ? "Alertas abertos da IA e perguntas esperando a direção." : "Alertas abertos da IA. As perguntas para a direção aparecem depois da migration 0246."}
        </p>
      </div>
      <LiteResponsiveData
        caption="Alertas por empresa"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.tenantId}
        onRowOpen={(row) => router.push(tenantAdminHref(row.tenantId))}
        empty={<p className={page.emptyText}>Nenhuma empresa cadastrada.</p>}
      />
    </section>
  );
}

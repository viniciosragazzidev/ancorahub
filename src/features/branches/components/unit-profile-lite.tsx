"use client";

/**
 * Perfil da unidade no visual Lite para o diretor (/unidades/[branchId]). Mesmos dados (getBranchProfileData) e mesmas
 * ações da tela atual: período na URL, exportar relatório, configurar distribuição, pausar ou reativar o corretor.
 * O gestor no Lite segue com o ManagerLiteUnitProfile, que é só leitura.
 */
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pause, Play, Settings2 } from "lucide-react";

import { StatCard } from "@/components/dashboard/metric-card";
import { LiteUrlSelect } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { toggleBrokerAvailabilityAction } from "@/features/branches/actions";
import type { BranchMember, BranchMetrics, BranchTopBroker } from "@/features/branches/queries";
import { DEFAULT_PERIOD, PERIOD_OPTIONS, type PeriodValue } from "@/shared/period";

import { UnitReportsLite } from "./unit-reports-lite";
import styles from "./unit-profile-lite.module.css";

export type UnitProfileLiteData = {
  branch: { id: string; name: string; status: "active" | "inactive"; acceptingLeads: boolean; autoDistribute: boolean };
  metrics: BranchMetrics;
  members: BranchMember[];
  topBrokers: BranchTopBroker[];
};

const ROLE_LABELS: Record<string, string> = { director: "Diretor", manager: "Gestor", supervisor: "Supervisor", broker: "Corretor" };

export function UnitProfileLite({ data, period, backHref }: { data: UnitProfileLiteData; period: PeriodValue; backHref: string }) {
  const router = useRouter();
  const { branch, metrics, members, topBrokers } = data;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const total = Math.max(1, metrics.totalLeads);
  const maxRate = Math.max(...topBrokers.map((broker) => broker.conversionRate), 1);

  const toggle = (member: BranchMember) => {
    const formData = new FormData();
    formData.set("brokerId", member.userId);
    setPendingId(member.userId);
    startTransition(async () => {
      try {
        const result = await toggleBrokerAvailabilityAction({}, formData);
        if (result.success) {
          toast.success("Disponibilidade atualizada.");
          router.refresh();
        }
        if (result.error) toast.error(result.error);
      } finally {
        setPendingId(null);
      }
    });
  };

  const columns: LiteColumn<BranchMember>[] = [
    {
      id: "name",
      label: "Nome",
      primary: true,
      render: (member) => (
        <span>
          {member.role === "broker" ? (
            <Link href={`/equipe/${encodeURIComponent(member.userId)}`} className={`${page.cellTitle} ${page.cellLink}`}>{member.name}</Link>
          ) : <span className={page.cellTitle}>{member.name}</span>}
          <span className={page.cellSub}>{member.email}</span>
        </span>
      ),
    },
    { id: "role", label: "Papel", render: (member) => <span className={page.badge}>{ROLE_LABELS[member.role] ?? member.role}</span> },
    { id: "availability", label: "Disponibilidade", render: (member) => <span className={page.badge} data-tone={member.availabilityStatus === "available" ? "success" : undefined}>{member.availabilityStatus === "available" ? "Disponível" : "Pausado"}</span> },
    { id: "active", label: "Leads ativos", numeric: true, render: (member) => member.activeLeads.toLocaleString("pt-BR") },
    {
      id: "action",
      label: "Ações",
      numeric: true,
      render: (member) => member.role === "broker" ? (
        <button type="button" className={page.iconButton} disabled={pendingId === member.userId} onClick={() => toggle(member)} aria-label={member.availabilityStatus === "available" ? `Pausar recebimento de ${member.name}` : `Retomar recebimento de ${member.name}`} title={member.availabilityStatus === "available" ? "Pausar" : "Reativar"}>
          {member.availabilityStatus === "available" ? <Pause aria-hidden="true" size={18} /> : <Play aria-hidden="true" size={18} />}
        </button>
      ) : <span className={page.muted}>Sem ação</span>,
    },
  ];

  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <div className={page.toolbar}>
        <Link href={backHref} className={page.button}><ArrowLeft aria-hidden="true" size={16} />Voltar</Link>
        <span className={page.badge} data-tone={branch.status === "active" ? "success" : undefined}>{branch.status === "active" ? "Ativa" : "Inativa"}</span>
        <span className={page.badge} data-tone={branch.acceptingLeads ? "info" : "warning"}>{branch.acceptingLeads ? "Recebendo leads" : "Pausada para leads"}</span>
        <span className={styles.actions}>
          <LiteUrlSelect className={page.selectNarrow} label="Período" param="period" value={String(period)} defaultValue={String(DEFAULT_PERIOD)} method="replace" options={PERIOD_OPTIONS.map((days) => ({ value: String(days), label: `${days} dias` }))} />
          <UnitReportsLite branchId={branch.id} branchName={branch.name} />
          <Link href="/distribuicao?view=filas" className={page.button}><Settings2 aria-hidden="true" size={16} />Configurar distribuição</Link>
        </span>
      </div>

      <div className={page.stats}>
        <StatCard label="Leads no período" value={metrics.totalLeads} sublabel={`mês: ${metrics.period}`} sparklineData={metrics.leadsTrend} sparklineColor="var(--chart-1)" animated />
        <StatCard label="Taxa de conversão" value={`${metrics.taxaConversao}%`} sublabel={metrics.totalLeads === 0 ? "sem leads no período" : `${metrics.leadsConvertidos} de ${metrics.totalLeads} leads`} sparklineData={metrics.leadsTrend.map((value) => Math.round((value / total) * metrics.taxaConversao))} sparklineColor="var(--chart-3)" animated animationDelay={0.06} />
        <StatCard label="Em atendimento" value={metrics.leadsAtivos} sublabel="leads em andamento" sparklineData={metrics.leadsTrend.map((value) => Math.round((value / total) * metrics.leadsAtivos))} sparklineColor="var(--chart-4)" animated animationDelay={0.12} />
        <StatCard label="Aguardando contato" value={metrics.leadsDistribuidos} sublabel={metrics.totalLeads === 0 ? "sem leads no período" : `${metrics.leadsPerdidos} perdido${metrics.leadsPerdidos !== 1 ? "s" : ""} no período`} sparklineData={metrics.leadsTrend.map((value) => Math.round((value / total) * metrics.leadsDistribuidos))} sparklineColor="var(--chart-2)" animated animationDelay={0.18} />
      </div>

      <div className={styles.columns}>
        <section className={page.group} aria-labelledby="unidade-membros">
          <h2 id="unidade-membros" className={page.sectionTitle}>Membros da unidade</h2>
          <LiteResponsiveData
            caption="Membros da unidade"
            columns={columns}
            rows={members}
            rowKey={(member) => member.userId}
            empty={<div><p className={page.emptyTitle}>Nenhum membro nesta unidade ainda.</p><p className={page.emptyText}>Convide corretores pela área de Equipe.</p></div>}
          />
        </section>

        <section className={page.card} aria-labelledby="unidade-ranking">
          <div className={styles.cardHeadRow}>
            <div className={page.cardHead}>
              <h2 id="unidade-ranking" className={page.sectionTitle}>Ranking de conversão</h2>
              <p className={page.muted}>Top corretores · {metrics.period}</p>
            </div>
          </div>
          {topBrokers.length === 0 ? (
            <p className={page.muted}>Sem dados de conversão no período {metrics.period}.</p>
          ) : (
            <ol className={styles.ranking} aria-label="Ranking de corretores por conversão">
              {topBrokers.map((broker, index) => (
                <li key={broker.userId} className={styles.rankRow}>
                  <span className={styles.rankHead}>
                    <span className={styles.position} aria-hidden="true">{index + 1}</span>
                    <Link href={`/equipe/${encodeURIComponent(broker.userId)}`} className={`${page.cellTitle} ${page.cellLink} ${styles.rankName}`} title={broker.name}>{broker.name}</Link>
                    <span className={`${page.cellSub} ${page.numeric}`}>{broker.converted}/{broker.totalLeads}</span>
                    <span className={`${page.numeric} ${styles.rate}`}>{broker.conversionRate}%</span>
                  </span>
                  <span className={styles.track} role="img" aria-label={`${broker.conversionRate}% de conversão`}>
                    <span className={styles.fill} style={{ width: `${Math.round((broker.conversionRate / maxRate) * 100)}%` }} />
                  </span>
                </li>
              ))}
            </ol>
          )}
          <Link href="/equipe" className={`${page.button} ${styles.fullButton}`}>Ver equipe completa</Link>
        </section>
      </div>
    </div>
  );
}

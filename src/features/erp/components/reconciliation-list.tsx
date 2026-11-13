"use client";
import Link from "next/link";
import { useState } from "react";
import { StatCard } from "@/components/dashboard/metric-card";
import { Button } from "@/components/ui/button";
import { formatCents } from "../contracts";
import type { ReconciliationGroup, ReconciliationIssue } from "../reconciliation";
import { ErpCell, ErpList, ErpNote, ErpPager, ErpPanel, ErpStats, ErpStatus, ErpToolbar, ErpUrlFilter, type ErpColumn, type ErpTone } from "../ui/erp-kit";
import { PayoutFacts } from "./payout-parts";

export type ReconciliationGroupCount = { key: ReconciliationGroup; label: string; count: number };

/** Short labels for the table (the full label stays in the filter and the drawer). */
const SHORT: Record<ReconciliationGroup, string> = {
  evidence: "Sem evidência", approval: "Aprovação", movement: "Movimento a conferir", overdue: "Vencido", legacy: "Divergência",
};
const TONE: Record<ReconciliationGroup, ErpTone> = { evidence: "warning", approval: "warning", movement: "info", overdue: "danger", legacy: "danger" };

/** Exception queue: 4 numbers, ONE list filtered by group in the URL, row → drawer with the link to resolve. */
export function ReconciliationList({ issues, groups, group, page, total, pageSize, truncated, calculatedAt }: {
  issues: ReconciliationIssue[]; groups: ReconciliationGroupCount[]; group: ReconciliationGroup | "all";
  page: number; total: number; pageSize: number; truncated: boolean; calculatedAt: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = issues.find((issue) => issue.key === openKey) ?? null;
  const label = (key: ReconciliationGroup) => groups.find((item) => item.key === key)?.label ?? key;
  const countOf = (key: ReconciliationGroup) => groups.find((item) => item.key === key)?.count ?? 0;
  const hint = truncated ? "mostrando os mais antigos" : undefined;
  const columns: ErpColumn<ReconciliationIssue>[] = [
    { id: "title", label: "Item", primary: true, render: (issue) => <ErpCell title={issue.title} sub={issue.detail} /> },
    { id: "group", label: "Motivo", render: (issue) => <ErpStatus tone={TONE[issue.group]}>{SHORT[issue.group]}</ErpStatus> },
    { id: "amount", label: "Valor", numeric: true, render: (issue) => issue.amountCents === null ? "Sem valor" : formatCents(issue.amountCents) },
  ];
  const updated = new Date(calculatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return <>
    <ErpStats>
      <StatCard label="Sem evidência" value={countOf("evidence").toLocaleString("pt-BR")} sublabel={hint ?? "anexar comprovante"} />
      <StatCard label="Aguardando aprovação" value={countOf("approval").toLocaleString("pt-BR")} sublabel={hint ?? "outra pessoa decide"} />
      <StatCard label="Movimentos a conferir" value={countOf("movement").toLocaleString("pt-BR")} sublabel={hint ?? "liquidação ou compensação"} />
      <StatCard label="Vencidos e divergências" value={(countOf("overdue") + countOf("legacy")).toLocaleString("pt-BR")} sublabel={hint ?? "sem registro ou fora do cronograma"} />
    </ErpStats>
    <ErpToolbar>
      <ErpUrlFilter label="Motivo" param="grupo" value={group} defaultValue="all"
        options={[{ value: "all", label: "Todos os motivos" }, ...groups.map((item) => ({ value: item.key, label: `${item.label} (${item.count})` }))]} />
    </ErpToolbar>
    <ErpList title="Itens a conferir" description={`Atualizado em ${updated}.`} count={total} countLabel={["item", "itens"]} columns={columns} rows={issues}
      rowKey={(issue) => issue.key} onRowOpen={(issue) => setOpenKey(issue.key)}
      emptyTitle="Nada pendente de conferência"
      emptyText="Todos os lançamentos do seu escopo estão aprovados, liquidados ou dentro do vencimento."
      footer={<>
        <ErpPager page={page} total={total} pageSize={pageSize} label="Paginação da conciliação" />
        {truncated ? <ErpNote>A fila mostra os 300 itens mais antigos de cada motivo. Resolva-os para ver os demais.</ErpNote> : null}
      </>} />
    <ErpPanel open={open !== null} onOpenChange={(next) => { if (!next) setOpenKey(null); }} title={open ? open.title : "Item"}
      description={open ? label(open.group) : undefined}>
      {open ? <>
        <PayoutFacts items={[
          { label: "Motivo", value: label(open.group) },
          { label: "Valor", value: open.amountCents === null ? "Sem valor" : formatCents(open.amountCents) },
        ]} />
        <ErpNote>{open.detail}</ErpNote>
        <div><Button render={<Link href={open.href} />}>Abrir para resolver</Button></div>
      </> : null}
    </ErpPanel>
  </>;
}

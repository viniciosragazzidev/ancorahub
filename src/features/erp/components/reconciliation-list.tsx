"use client";
import Link from "next/link";
import { useState } from "react";
import { StatCard } from "@/components/dashboard/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "../contracts";
import type { ReconciliationGroup, ReconciliationIssue } from "../reconciliation";
import { ErpList, ErpNote, ErpPager, ErpPanel, ErpToolbar, ErpUrlFilter, type ErpColumn } from "../ui/erp-kit";
import { PayoutFacts } from "./payout-parts";

export type ReconciliationGroupCount = { key: ReconciliationGroup; label: string; count: number };

/** Exception queue: counts per group, ONE list filtered by group in the URL, row → drawer with the link to resolve. */
export function ReconciliationList({ issues, groups, group, page, total, pageSize, truncated, calculatedAt }: {
  issues: ReconciliationIssue[]; groups: ReconciliationGroupCount[]; group: ReconciliationGroup | "all";
  page: number; total: number; pageSize: number; truncated: boolean; calculatedAt: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = issues.find((issue) => issue.key === openKey) ?? null;
  const label = (key: ReconciliationGroup) => groups.find((item) => item.key === key)?.label ?? key;
  const columns: ErpColumn<ReconciliationIssue>[] = [
    { id: "title", label: "Item", primary: true, render: (issue) => issue.title },
    { id: "detail", label: "Detalhe", secondary: true, render: (issue) => issue.detail },
    { id: "group", label: "Grupo", render: (issue) => <Badge variant="outline">{label(issue.group)}</Badge> },
    { id: "amount", label: "Valor", numeric: true, render: (issue) => issue.amountCents === null ? "—" : formatCents(issue.amountCents) },
  ];
  const updated = new Date(calculatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return <>
    <ErpNote>
      Fila do que precisa de uma pessoa: evidência faltando, aprovação, movimentos a conferir, vencidos sem registro e diferenças com o
      cronograma antigo. Atualizado em {updated}.
    </ErpNote>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {groups.map((item) => <StatCard key={item.key} label={item.label} value={item.count}
        sublabel={truncated ? "Mostrando os mais antigos" : undefined} />)}
    </div>
    <ErpToolbar>
      <ErpUrlFilter label="Grupo" param="grupo" value={group} defaultValue="all"
        options={[{ value: "all", label: "Todos os grupos" }, ...groups.map((item) => ({ value: item.key, label: item.label }))]} />
    </ErpToolbar>
    <ErpList title="Itens a conferir" columns={columns} rows={issues} rowKey={(issue) => issue.key} onRowOpen={(issue) => setOpenKey(issue.key)}
      emptyTitle="Nada pendente de conferência"
      emptyText="Todos os lançamentos do seu escopo estão aprovados, liquidados ou dentro do vencimento."
      footer={<ErpPager page={page} total={total} pageSize={pageSize} label="Paginação da conciliação" />} />
    {truncated ? <ErpNote>A fila mostra os 300 itens mais antigos de cada grupo. Resolva-os para ver os demais.</ErpNote> : null}
    <ErpPanel open={open !== null} onOpenChange={(next) => { if (!next) setOpenKey(null); }} title={open ? open.title : "Item"}
      description={open ? label(open.group) : undefined}>
      {open ? <>
        <PayoutFacts items={[
          { label: "Grupo", value: label(open.group) },
          { label: "Valor", value: open.amountCents === null ? "—" : formatCents(open.amountCents) },
        ]} />
        <ErpNote>{open.detail}</ErpNote>
        <div><Button render={<Link href={open.href} />}>Abrir para resolver</Button></div>
      </> : null}
    </ErpPanel>
  </>;
}

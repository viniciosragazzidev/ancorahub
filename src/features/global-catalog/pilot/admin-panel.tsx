"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppSelect } from "@/components/ui/select";
import { reviewPassingPlansAction, updatePilotAction } from "./admin-action";
import { fold } from "./engine";
import type { PilotConfig } from "./contracts";
import { REVIEW_ISSUE_LABEL, summarizeReview, type ReviewIssue } from "./review-check";

type PanelPlan = { id: string; name: string; operator: string; operatorId: string; issues: ReviewIssue[] };

export function PilotAdminPanel({ config, plans }: { config: PilotConfig; plans: PanelPlan[] }) {
  const [query, setQuery] = useState(""), [reason, setReason] = useState(""), [message, setMessage] = useState("");
  const [operator, setOperator] = useState("");
  const [pending, start] = useTransition(); const router = useRouter();
  const reviewed = useMemo(() => new Set(config.reviewedPlanIds), [config.reviewedPlanIds]);
  const filtered = useMemo(() => plans.filter(p => !query || fold(`${p.id} ${p.name} ${p.operator}`).includes(fold(query))), [plans, query]);
  const operators = useMemo(() => {
    const byId = new Map<string, { label: string; count: number }>();
    for (const plan of plans) byId.set(plan.operatorId, { label: plan.operator, count: (byId.get(plan.operatorId)?.count ?? 0) + 1 });
    return [...byId].map(([value, { label, count }]) => ({ value, label: `${label} (${count})` })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [plans]);
  const scope = useMemo(() => plans.filter(p => !operator || p.operatorId === operator), [plans, operator]);
  const summary = useMemo(() => summarizeReview(scope.map(p => ({ issues: p.issues, reviewed: reviewed.has(p.id) }))), [scope, reviewed]);
  const toApprove = scope.filter(p => !p.issues.length && !reviewed.has(p.id)).length;

  function update(operation: "enable" | "disable" | "review" | "unreview" | "hide" | "show", planId?: string) {
    start(async () => { const result = await updatePilotAction({ release: config.release, operation, planId, reason }); setMessage(result.error || "Alteração registrada e auditada."); if (result.success) router.refresh(); });
  }
  function reviewBulk() {
    start(async () => {
      const result = await reviewPassingPlansAction({ release: config.release, operator, reason });
      setMessage(result.error || `${result.added} ${result.added === 1 ? "plano revisado" : "planos revisados"} e auditados.`);
      if (result.success) router.refresh();
    });
  }

  return <Card><CardHeader><CardTitle>Cotador real · piloto exclusivo</CardTitle><CardDescription>Limitado ao corretor Vinicios Ragazzi no vínculo ativo. A revogação bloqueia novas consultas e exportações no servidor.</CardDescription></CardHeader><CardContent className="grid gap-4">
    <div className="flex flex-wrap items-center gap-3"><Badge variant="outline">{config.enabled ? "Liberado" : "Desativado"}</Badge><p className="text-xs text-muted-foreground">{config.release}</p></div>
    <label className="grid gap-2 text-sm">Motivo da alteração / evidência da revisão<Input value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} placeholder="Informe a conferência realizada ou o motivo da alteração" /></label>
    <div><Button disabled={pending} variant="outline" onClick={() => update(config.enabled ? "disable" : "enable")}>{config.enabled ? "Desativar acesso" : "Liberar para Vinicios"}</Button></div>
    <p className="text-xs text-muted-foreground">A revisão do produto não elimina critérios de elegibilidade pendentes para o perfil. Preços e campos da fonte são versionados em um novo lote pelo procedimento de publicação.</p>

    <section className="grid gap-3 rounded-[var(--radius-card)] border border-border p-4" aria-labelledby="bulk-review-title">
      <div className="grid gap-1">
        <h3 id="bulk-review-title" className="text-sm font-medium">Conferir e revisar em lote</h3>
        <p className="text-xs leading-5 text-muted-foreground">A conferência automática olha os dados do lote: vigência, preço ativo em cada faixa etária da ANS, preço duplicado, município de comercialização e critérios confirmados na fonte. Só os planos que passam em tudo entram na revisão em lote; o motivo acima fica registrado na auditoria. Ela não substitui a leitura do material da operadora.</p>
      </div>
      <AppSelect aria-label="Operadora" value={operator} onValueChange={setOperator} options={[{ value: "", label: `Todas as operadoras (${plans.length})` }, ...operators]} />
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-xs text-muted-foreground">Planos</dt><dd className="tabular-nums">{summary.total}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Passam na conferência</dt><dd className="tabular-nums">{summary.passed}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Já revisados</dt><dd className="tabular-nums">{summary.reviewed}</dd></div>
      </dl>
      {Object.keys(summary.issues).length ? (
        <ul className="grid gap-0.5 text-xs text-muted-foreground">
          {(Object.entries(summary.issues) as [ReviewIssue, number][]).sort((a, b) => b[1] - a[1]).map(([issue, count]) => <li key={issue}>{REVIEW_ISSUE_LABEL[issue]}: {count}</li>)}
        </ul>
      ) : null}
      <div><Button disabled={pending || !toApprove || reason.trim().length < 10} variant="outline" onClick={reviewBulk}>{toApprove === 1 ? "Registrar revisão do plano que passou" : toApprove ? `Registrar revisão dos ${toApprove} que passaram` : "Nenhum plano novo para revisar"}</Button></div>
      {toApprove && reason.trim().length < 10 ? <p className="text-xs text-muted-foreground">Escreva o motivo (o que foi conferido) para liberar o botão.</p> : null}
    </section>

    <label className="grid gap-2 text-sm">Localizar produto<Input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Operadora, nome ou identificador do plano" /></label>
    <p role="status" className="text-sm text-muted-foreground">{filtered.length} produtos · mostrando até 20. Refine a busca para localizar os demais.</p>
    <ul className="divide-y divide-border">{filtered.slice(0, 20).map(p => <li key={p.id} className="grid gap-3 py-4"><div><p className="text-sm font-medium">{p.operator} · {p.name}</p><p className="break-all text-xs text-muted-foreground">{p.id} · {reviewed.has(p.id) ? "Produto revisado" : "Revisão pendente"} · {config.hiddenPlanIds.includes(p.id) ? "Oculto no piloto" : "Visível"}</p><p className="text-xs text-muted-foreground">{p.issues.length ? `Conferência: ${p.issues.map(issue => REVIEW_ISSUE_LABEL[issue]).join(", ")}` : "Conferência automática: sem problemas"}</p></div><div className="flex flex-wrap gap-2"><Button disabled={pending} variant="outline" size="sm" onClick={() => update(reviewed.has(p.id) ? "unreview" : "review", p.id)}>{reviewed.has(p.id) ? "Reabrir revisão" : "Registrar revisão"}</Button><Button disabled={pending} variant="outline" size="sm" onClick={() => update(config.hiddenPlanIds.includes(p.id) ? "show" : "hide", p.id)}>{config.hiddenPlanIds.includes(p.id) ? "Exibir produto" : "Ocultar produto"}</Button></div></li>)}</ul>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </CardContent></Card>;
}

"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { updatePilotAction } from "./admin-action";
import { fold } from "./engine";
import type { PilotConfig } from "./contracts";

export function PilotAdminPanel({ config, plans }: { config: PilotConfig; plans: { id: string; name: string; operator: string }[] }) {
  const [query, setQuery] = useState(""), [reason, setReason] = useState(""), [message, setMessage] = useState("");
  const [pending, start] = useTransition(); const router = useRouter();
  const filtered = useMemo(() => plans.filter(p => !query || fold(`${p.id} ${p.name} ${p.operator}`).includes(fold(query))), [plans, query]);
  function update(operation: "enable" | "disable" | "review" | "unreview" | "hide" | "show", planId?: string) {
    start(async () => { const result = await updatePilotAction({ release: config.release, operation, planId, reason }); setMessage(result.error || "Alteração registrada e auditada."); if (result.success) router.refresh(); });
  }
  return <Card><CardHeader><CardTitle>Cotador real · piloto exclusivo</CardTitle><CardDescription>Limitado ao corretor Vinicios Ragazzi no vínculo ativo. A revogação bloqueia novas consultas e exportações no servidor.</CardDescription></CardHeader><CardContent className="grid gap-4">
    <div className="flex flex-wrap items-center gap-3"><Badge variant="outline">{config.enabled ? "Liberado" : "Desativado"}</Badge><p className="text-xs text-muted-foreground">{config.release}</p></div>
    <label className="grid gap-2 text-sm">Motivo da alteração / evidência da revisão<Input value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} placeholder="Informe a conferência realizada ou o motivo da alteração" /></label>
    <div><Button disabled={pending} variant="outline" onClick={() => update(config.enabled ? "disable" : "enable")}>{config.enabled ? "Desativar acesso" : "Liberar para Vinicios"}</Button></div>
    <p className="text-xs text-muted-foreground">A revisão do produto não elimina critérios de elegibilidade pendentes para o perfil. Preços e campos da fonte são versionados em um novo lote pelo procedimento de publicação.</p>
    <label className="grid gap-2 text-sm">Localizar produto<Input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Operadora, nome ou identificador do plano" /></label>
    <p role="status" className="text-sm text-muted-foreground">{filtered.length} produtos · mostrando até 20. Refine a busca para localizar os demais.</p>
    <ul className="divide-y divide-border">{filtered.slice(0, 20).map(p => <li key={p.id} className="grid gap-3 py-4"><div><p className="text-sm font-medium">{p.operator} · {p.name}</p><p className="break-all text-xs text-muted-foreground">{p.id} · {config.reviewedPlanIds.includes(p.id) ? "Produto revisado" : "Revisão pendente"} · {config.hiddenPlanIds.includes(p.id) ? "Oculto no piloto" : "Visível"}</p></div><div className="flex flex-wrap gap-2"><Button disabled={pending} variant="outline" size="sm" onClick={() => update(config.reviewedPlanIds.includes(p.id) ? "unreview" : "review", p.id)}>{config.reviewedPlanIds.includes(p.id) ? "Reabrir revisão" : "Registrar revisão"}</Button><Button disabled={pending} variant="outline" size="sm" onClick={() => update(config.hiddenPlanIds.includes(p.id) ? "show" : "hide", p.id)}>{config.hiddenPlanIds.includes(p.id) ? "Exibir produto" : "Ocultar produto"}</Button></div></li>)}</ul>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </CardContent></Card>;
}

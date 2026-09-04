"use client";

import { useState } from "react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveDistributionPolicyAction } from "@/features/lead-distribution/actions";

type Policy = { excludedBrokerIds?: string[]; ranking?: { enabled?: boolean; conversionWeight?: number; slaWeight?: number; manualPriorityWeight?: number } };

export function DistributionPolicyPanel({ canEdit, brokers, policy }: { canEdit: boolean; brokers: { id: string; name: string }[]; policy: unknown }) {
  const current = (policy ?? {}) as Policy;
  const [excludedBrokerIds, setExcludedBrokerIds] = useState(current.excludedBrokerIds ?? []);
  const [ranking, setRanking] = useState({ enabled: current.ranking?.enabled ?? true, conversionWeight: current.ranking?.conversionWeight ?? 45, slaWeight: current.ranking?.slaWeight ?? 35, manualPriorityWeight: current.ranking?.manualPriorityWeight ?? 20 });
  const [saving, setSaving] = useState(false);
  async function save() { setSaving(true); const result = await saveDistributionPolicyAction({ excludedBrokerIds, excludedBranchIds: [], ranking }); if (result.success) toast.success("Política de distribuição salva."); else toast.error(result.error ?? "Não foi possível salvar a política."); setSaving(false); }
  return <Card><CardHeader><CardTitle>Distribuição inteligente</CardTitle><CardDescription>Leads qualificados vão primeiro ao plantão ativo; depois o ranking considera conversão, SLA, carga e tempo sem novo lead.</CardDescription></CardHeader><CardContent className="grid gap-4"><label className="flex items-center gap-2 text-sm"><input checked={ranking.enabled} disabled={!canEdit} onChange={(event) => setRanking({ ...ranking, enabled: event.target.checked })} type="checkbox" />Usar ranking depois do plantão</label><div className="grid gap-3 md:grid-cols-3">{([['conversionWeight','Conversão'],['slaWeight','SLA'],['manualPriorityWeight','Prioridade manual']] as const).map(([key,label]) => <Field key={key}><FieldLabel>{label}</FieldLabel><Input disabled={!canEdit} max={100} min={0} onChange={(event) => setRanking({ ...ranking, [key]: Number(event.target.value) })} type="number" value={ranking[key]} /></Field>)}</div><Field><FieldLabel>Corretores excluídos</FieldLabel><div className="grid gap-2 sm:grid-cols-2">{brokers.map((broker) => <label className="flex items-center gap-2 text-sm" key={broker.id}><input checked={excludedBrokerIds.includes(broker.id)} disabled={!canEdit} onChange={(event) => setExcludedBrokerIds(event.target.checked ? [...excludedBrokerIds, broker.id] : excludedBrokerIds.filter((id) => id !== broker.id))} type="checkbox" />{broker.name}</label>)}</div></Field>{canEdit ? <Button className="w-fit" disabled={saving} onClick={save} variant="outline">{saving ? "Salvando…" : "Salvar distribuição"}</Button> : null}</CardContent></Card>;
}

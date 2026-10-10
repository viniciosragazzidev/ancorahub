"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/arc/search-field/search-field";
import ChipGroup from "@/components/arc/chip-group/chip-group";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { MetricCard } from "@/components/arc/metric-card/metric-card";

import styles from "./supervisor-leads-radar.module.css";

export type RadarLead = {
  id: string; name: string; phone: string | null; status: string; ownerId: string; ownerName: string;
  ownerImage: string | null; productName: string | null; assignedAt: string | null;
  firstContactAt: string | null; stageEnteredAt: string | null;
};
export type RadarTeamMember = { id: string; name: string; image: string | null; availability: string; openCount: number; late: number };
export type RadarFunnel = { new: number; firstContact: number; service: number; quote: number; closing: number };

const funnel = [
  { id: "new", label: "Novos" }, { id: "firstContact", label: "1º contato" },
  { id: "service", label: "Em atendimento" }, { id: "quote", label: "Cotação" }, { id: "closing", label: "Fechando" },
] as const;
const serviceStatuses = new Set(["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"]);
const statusName: Record<string, string> = { new: "Novo", distributed: "Aguardando contato", in_contact: "Em atendimento", quote_sent: "Cotação enviada", negotiation: "Negociação", documentation_pending: "Documentação", under_analysis: "Em análise" };

export function classifyRadarLead(lead: RadarLead, now: Date, slaMinutes: number) {
  const age = lead.assignedAt ? Math.max(0, now.getTime() - new Date(lead.assignedAt).getTime()) : 0;
  if (!lead.firstContactAt && age > slaMinutes * 60_000) return "late" as const;
  if (!lead.firstContactAt) return "waiting" as const;
  if (serviceStatuses.has(lead.status) && lead.stageEnteredAt && now.getTime() - new Date(lead.stageEnteredAt).getTime() > 3 * 86_400_000) return "stalled" as const;
  return "service" as const;
}

function elapsed(value: string | null, now: Date) {
  if (!value) return "agora";
  const minutes = Math.max(1, Math.floor((now.getTime() - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `há ${hours} h` : `há ${Math.floor(hours / 24)} dias`;
}
export function SupervisorLeadsRadar({ data, now, search = "" }: { data: { team: RadarTeamMember[]; leads: RadarLead[]; funnel: RadarFunnel; slaMinutes: number }; now: string; search?: string }) {
  const [query, setQuery] = useState(search);
  const [brokerId, setBrokerId] = useState<string | null>(null);
  const [stage, setStage] = useState<keyof RadarFunnel | null>(null);
  const currentTime = useMemo(() => new Date(now), [now]);
  const filtered = useMemo(() => data.leads.filter((lead) => {
    const ownerMatch = !brokerId || lead.ownerId === brokerId;
    const searchMatch = !query.trim() || `${lead.name} ${lead.phone ?? ""} ${lead.ownerName}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"));
    const bucket = classifyRadarLead(lead, currentTime, data.slaMinutes);
    const stageMatch = !stage || (stage === "new" ? ["new", "distributed"].includes(lead.status) : stage === "firstContact" ? bucket === "waiting" : stage === "service" ? bucket === "service" : stage === "quote" ? lead.status === "quote_sent" : ["negotiation", "documentation_pending", "under_analysis"].includes(lead.status));
    return ownerMatch && searchMatch && stageMatch;
  }).sort((a, b) => {
    const rank = { late: 0, waiting: 1, stalled: 3, service: 2 };
    return rank[classifyRadarLead(a, currentTime, data.slaMinutes)] - rank[classifyRadarLead(b, currentTime, data.slaMinutes)] || new Date(a.assignedAt ?? 0).getTime() - new Date(b.assignedAt ?? 0).getTime();
  }), [data.leads, data.slaMinutes, brokerId, currentTime, query, stage]);
  const groups = [
    { id: "late", title: "Atrasados" }, { id: "waiting", title: "Aguardando primeiro contato" },
    { id: "service", title: "Em atendimento" }, { id: "stalled", title: "Parados há 3 dias ou mais" },
  ] as const;

  return <div className={`arc-venancor ${styles.page}`}>
    <header className={styles.header}><div><h1>Leads da equipe</h1><p>Veja onde cada conversa precisa de atenção.</p></div><span className={styles.total}>{filtered.length} leads</span></header>
    <section className={styles.funnel} aria-label="Funil da equipe">{funnel.map((item) => <button type="button" key={item.id} aria-pressed={stage === item.id} data-active={stage === item.id} onClick={() => setStage((value) => value === item.id ? null : item.id)}><MetricCard label={item.label} value={data.funnel[item.id]} context="leads" /></button>)}</section>
    <ChipGroup label="Filtrar por etapa" multiple={false} options={funnel.map((item) => ({ value: item.id, label: item.label }))} value={stage ? [stage] : []} onValueChange={(values) => setStage((values[0] as keyof RadarFunnel | undefined) ?? null)} />
    <div className={styles.avatarRail} role="list" aria-label="Corretores da equipe">
      {data.team.map((member) => <div key={member.id} role="listitem" className={styles.avatarChip}>
        <Avatar name={member.name} src={member.image ?? undefined} size="lg" status={member.availability === "available" ? "online" : "offline"} className={`${styles.avatar} ${member.late ? styles.avatarLate : ""}`} /><span className={styles.memberName}>{member.name.split(/\s+/)[0]}</span><Badge size="sm" tone={member.late ? "danger" : "neutral"}>{member.openCount}</Badge>
      </div>)}
    </div>
    <ChipGroup label="Filtrar por corretor" multiple={false} options={[{ value: "all", label: "Toda a equipe" }, ...data.team.map((member) => ({ value: member.id, label: member.name }))]} value={brokerId ? [brokerId] : ["all"]} onValueChange={(values) => setBrokerId(values[0] && values[0] !== "all" ? values[0] : null)} />
    <SearchField label="Buscar lead ou corretor" placeholder="Nome do lead ou corretor" value={query} onValueChange={setQuery} />
    {groups.map((group) => {
      const rows = filtered.filter((lead) => classifyRadarLead(lead, currentTime, data.slaMinutes) === group.id);
      if (!rows.length) return null;
      return <section className={styles.group} key={group.id}><h2>{group.title}<span>{rows.length}</span></h2><ul>{rows.map((lead) => {
        const bucket = classifyRadarLead(lead, currentTime, data.slaMinutes);
        const assignedAt = lead.assignedAt ? new Date(lead.assignedAt).getTime() : currentTime.getTime();
        const elapsedMs = Math.max(0, currentTime.getTime() - assignedAt);
        const percent = Math.min(100, Math.round(elapsedMs / (data.slaMinutes * 60_000) * 100));
        return <li className={styles.leadCard} key={lead.id}>
          <div className={styles.leadIdentity}><span className={`${styles.slaRing} ${bucket === "late" ? styles.slaLate : ""}`} style={{ "--sla-progress": `${percent}%` } as React.CSSProperties} aria-label={bucket === "late" ? "SLA estourado" : "Dentro do SLA"}><span>◷</span></span><div><Link href={`/leads/${encodeURIComponent(lead.id)}`} className={styles.leadName}>{lead.name}</Link><p>{lead.productName ?? "Lead"} · {statusName[lead.status] ?? "Em andamento"}</p></div><span className={styles.elapsed}>{elapsed(lead.assignedAt, currentTime)}</span></div>
          <div className={styles.owner}><Avatar name={lead.ownerName} src={lead.ownerImage ?? undefined} size="sm" className={styles.ownerAvatar} /><span>{lead.ownerName.split(/\s+/)[0]}</span><Badge size="sm">{statusName[lead.status] ?? lead.status}</Badge></div>
          <div className={styles.actions}><Button variant="outline" size="sm" render={<Link href={`/equipe/repassar?lead=${encodeURIComponent(lead.id)}`} />}>Repassar</Button><Button size="sm" render={<Link href={`/relacionamento?brokerId=${encodeURIComponent(lead.ownerId)}&leadId=${encodeURIComponent(lead.id)}&action=reminder`} />}>Cobrar</Button></div>
        </li>;
      })}</ul></section>;
    })}
    {!filtered.length ? <EmptyState title={query || brokerId || stage ? "Nenhum lead encontrado" : "Nenhum lead parado na equipe"} description={query || brokerId || stage ? "Ajuste os filtros para ver outros leads." : "A equipe está em dia. Volte mais tarde para acompanhar."} /> : null}
  </div>;
}

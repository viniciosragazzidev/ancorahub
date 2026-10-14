"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, useReducedMotionConfig, type Transition } from "motion/react";

import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/arc/search-field/search-field";
import { Avatar } from "@/components/arc/avatar/avatar";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { motionTokens } from "@/components/arc/lib/motion-tokens";

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
  { id: "service", label: "Atendimento" }, { id: "quote", label: "Cotação" }, { id: "closing", label: "Fechando" },
] as const;
const serviceStatuses = new Set(["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"]);
const statusName: Record<string, string> = { new: "Novo", distributed: "Aguardando contato", in_contact: "Em atendimento", quote_sent: "Cotação enviada", negotiation: "Negociação", documentation_pending: "Documentação", under_analysis: "Em análise" };

type Bucket = "late" | "waiting" | "service" | "stalled";
const groups: Array<{ id: Bucket; title: string; hint: string }> = [
  { id: "late", title: "Atrasados", hint: "Sem primeiro contato além do prazo" },
  { id: "waiting", title: "Aguardando primeiro contato", hint: "Ainda dentro do prazo" },
  { id: "stalled", title: "Parados", hint: "Na mesma etapa há 3 dias ou mais" },
  { id: "service", title: "Em atendimento", hint: "Andando normalmente" },
];

export function classifyRadarLead(lead: RadarLead, now: Date, slaMinutes: number): Bucket {
  const age = lead.assignedAt ? Math.max(0, now.getTime() - new Date(lead.assignedAt).getTime()) : 0;
  if (!lead.firstContactAt && age > slaMinutes * 60_000) return "late";
  if (!lead.firstContactAt) return "waiting";
  if (serviceStatuses.has(lead.status) && lead.stageEnteredAt && now.getTime() - new Date(lead.stageEnteredAt).getTime() > 3 * 86_400_000) return "stalled";
  return "service";
}

function elapsed(value: string | null, now: Date) {
  if (!value) return "agora";
  const minutes = Math.max(1, Math.floor((now.getTime() - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `há ${hours} h` : `há ${Math.floor(hours / 24)} d`;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

function matchesStage(stage: keyof RadarFunnel, lead: RadarLead, bucket: Bucket) {
  if (stage === "new") return lead.status === "new" || lead.status === "distributed";
  if (stage === "firstContact") return bucket === "waiting" || bucket === "late";
  if (stage === "service") return lead.status === "in_contact";
  if (stage === "quote") return lead.status === "quote_sent";
  return ["negotiation", "documentation_pending", "under_analysis"].includes(lead.status);
}

/** SLA ring: fills as the first-contact deadline runs out (only while there is no first contact). */
function SlaRing({ percent, bucket }: { percent: number; bucket: Bucket }) {
  const radius = 15;
  const length = 2 * Math.PI * radius;
  const done = bucket === "service" || bucket === "stalled";
  const value = done ? 100 : percent;
  return (
    <span className={styles.ring} data-bucket={bucket} role="img" aria-label={bucket === "late" ? "Prazo de primeiro contato estourado" : done ? "Primeiro contato feito" : `${percent}% do prazo usado`}>
      <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
        <circle cx="18" cy="18" r={radius} className={styles.ringTrack} />
        <circle cx="18" cy="18" r={radius} className={styles.ringValue} strokeDasharray={length} strokeDashoffset={length * (1 - value / 100)} />
      </svg>
      <span className={styles.ringIcon} aria-hidden="true">
        {done ? (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></svg>
        )}
      </span>
    </span>
  );
}

export function SupervisorLeadsRadar({ data, now, search = "", audience = "supervisor" }: { data: { team: RadarTeamMember[]; leads: RadarLead[]; funnel: RadarFunnel; slaMinutes: number }; now: string; search?: string; audience?: "supervisor" | "manager" }) {
  const isManager = audience === "manager";
  const reduce = useReducedMotionConfig();
  const [query, setQuery] = useState(search);
  const [brokerId, setBrokerId] = useState<string | null>(null);
  const [stage, setStage] = useState<keyof RadarFunnel | null>(null);
  const currentTime = useMemo(() => new Date(now), [now]);

  const classified = useMemo(() => data.leads.map((lead) => ({ lead, bucket: classifyRadarLead(lead, currentTime, data.slaMinutes) })), [data.leads, data.slaMinutes, currentTime]);
  const lateTotal = classified.filter((item) => item.bucket === "late").length;
  const funnelTotal = funnel.reduce((total, item) => total + data.funnel[item.id], 0);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return classified
      .filter(({ lead, bucket }) => (!brokerId || lead.ownerId === brokerId)
        && (!term || `${lead.name} ${lead.phone ?? ""} ${lead.ownerName}`.toLocaleLowerCase("pt-BR").includes(term))
        && (!stage || matchesStage(stage, lead, bucket)))
      .sort((a, b) => new Date(a.lead.assignedAt ?? 0).getTime() - new Date(b.lead.assignedAt ?? 0).getTime());
  }, [classified, brokerId, query, stage]);

  const filtering = Boolean(query.trim() || brokerId || stage);
  const enter = (index: number): Transition => reduce ? { duration: 0 } : { duration: motionTokens.duration.standard, delay: Math.min(index, 8) * 0.03, ease: [...motionTokens.ease.enter] as [number, number, number, number] };

  return (
    <div className={`arc-venancor ${styles.page}`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1>{isManager ? "Leads da unidade" : "Leads da equipe"}</h1>
          <p>{lateTotal ? <><strong className={styles.alert}>{lateTotal === 1 ? "1 lead atrasado" : `${lateTotal} leads atrasados`}</strong> precisando de você agora.</> : "Tudo em dia. Acompanhe onde cada lead está."}</p>
        </header>

        <section className={styles.funnel} aria-label="Funil da equipe. Toque numa etapa para filtrar">
          {funnel.map((item) => {
            const value = data.funnel[item.id];
            const share = funnelTotal ? Math.max(6, Math.round(value / funnelTotal * 100)) : 0;
            return (
              <button type="button" key={item.id} className={styles.stage} aria-pressed={stage === item.id} onClick={() => setStage((current) => current === item.id ? null : item.id)}>
                <strong>{value}</strong>
                <span>{item.label}</span>
                <i className={styles.stageBar} style={{ "--share": `${share}%` } as React.CSSProperties} aria-hidden="true" />
              </button>
            );
          })}
        </section>

        {data.team.length ? (
          <section className={styles.team} aria-label="Filtrar por corretor">
            <button type="button" className={styles.member} aria-pressed={!brokerId} onClick={() => setBrokerId(null)}>
              <span className={styles.allAvatar} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9" r="2.6" /><path d="M15.5 14.2A4.6 4.6 0 0 1 21 18.5" /></svg>
              </span>
              <span className={styles.memberName}>Todos</span>
            </button>
            {data.team.map((member) => (
              <button type="button" key={member.id} className={styles.member} data-late={member.late > 0} aria-pressed={brokerId === member.id} onClick={() => setBrokerId((current) => current === member.id ? null : member.id)} aria-label={`${member.name}: ${member.openCount === 1 ? "1 lead aberto" : `${member.openCount} leads abertos`}${member.late ? `, ${member.late} atrasado${member.late === 1 ? "" : "s"}` : ""}`}>
                <span className={styles.memberAvatar}>
                  <Avatar name={member.name} src={member.image ?? undefined} size="lg" status={member.availability === "available" ? "online" : "offline"} />
                  {member.openCount ? <span className={styles.memberCount} data-late={member.late > 0}>{member.openCount}</span> : null}
                </span>
                <span className={styles.memberName}>{firstName(member.name)}</span>
              </button>
            ))}
          </section>
        ) : null}

        <SearchField label="Buscar lead ou corretor" placeholder="Nome, telefone ou corretor" value={query} onValueChange={setQuery} />

        {filtering ? (
          <div className={styles.filterBar}>
            <span>{filtered.length === 1 ? "1 lead" : `${filtered.length} leads`}</span>
            <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setBrokerId(null); setStage(null); }}>Limpar filtros</Button>
          </div>
        ) : null}

        {groups.map((group) => {
          const rows = filtered.filter((item) => item.bucket === group.id);
          if (!rows.length) return null;
          return (
            <section className={styles.group} key={group.id} data-bucket={group.id} aria-labelledby={`radar-${group.id}`}>
              <div className={styles.groupTitle}>
                <i aria-hidden="true" />
                <h2 id={`radar-${group.id}`}>{group.title}</h2>
                <span className={styles.groupCount}>{rows.length}</span>
                <small>{group.hint}</small>
              </div>
              <ul>
                {rows.map(({ lead, bucket }, index) => {
                  const assignedAt = lead.assignedAt ? new Date(lead.assignedAt).getTime() : currentTime.getTime();
                  const percent = Math.min(100, Math.round(Math.max(0, currentTime.getTime() - assignedAt) / (data.slaMinutes * 60_000) * 100));
                  return (
                    <motion.li key={lead.id} className={styles.card} data-bucket={bucket} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={enter(index)}>
                      <Link href={`/leads/${encodeURIComponent(lead.id)}`} className={styles.cardMain}>
                        <SlaRing percent={percent} bucket={bucket} />
                        <span className={styles.cardText}>
                          <strong>{lead.name}</strong>
                          <span>{[lead.productName, statusName[lead.status] ?? "Em andamento"].filter(Boolean).join(" · ")}</span>
                        </span>
                        <span className={styles.cardMeta}>
                          {lead.ownerId ? <span className={styles.owner}><Avatar name={lead.ownerName} src={lead.ownerImage ?? undefined} size="sm" />{firstName(lead.ownerName)}</span> : <span className={styles.owner}>Sem corretor</span>}
                          <span className={styles.elapsed} data-late={bucket === "late"}>{elapsed(bucket === "stalled" ? lead.stageEnteredAt : lead.assignedAt, currentTime)}</span>
                        </span>
                      </Link>
                      {isManager ? null : <div className={styles.cardActions}>
                        <Button variant="outline" size="sm" render={<Link href={`/equipe/repassar?lead=${encodeURIComponent(lead.id)}`} />}>Repassar</Button>
                        <Button size="sm" render={<Link href={`/relacionamento?brokerId=${encodeURIComponent(lead.ownerId)}&leadId=${encodeURIComponent(lead.id)}&action=reminder`} />}>Cobrar {firstName(lead.ownerName)}</Button>
                      </div>}
                    </motion.li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        {!filtered.length ? (
          <EmptyState
            title={filtering ? "Nenhum lead com esses filtros" : "Nenhum lead aberto na equipe"}
            description={filtering ? "Troque a etapa, o corretor ou a busca." : "Quando a equipe receber leads, eles aparecem aqui por urgência."}
          />
        ) : null}
      </div>
    </div>
  );
}

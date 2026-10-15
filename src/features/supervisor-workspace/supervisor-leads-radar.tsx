"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { SearchField } from "@/components/arc/search-field/search-field";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";

import styles from "./supervisor-leads-radar.module.css";

export type RadarTag = { id: string; name: string; colorHue: number | null };
export type RadarLead = {
  id: string; name: string; phone: string | null; status: string; ownerId: string; ownerName: string;
  ownerImage: string | null; productName: string | null; assignedAt: string | null;
  firstContactAt: string | null; stageEnteredAt: string | null;
  /** Filled by withRadarSignals: the lead's tags, when the client wrote last on WhatsApp, and past-due tasks. */
  tags?: RadarTag[]; clientWaitingSince?: string | null; overdueTasks?: number;
};
export type RadarTeamMember = { id: string; name: string; image: string | null; availability: string; openCount: number; late: number };
export type RadarFunnel = { new: number; firstContact: number; service: number; quote: number; closing: number };

const serviceStatuses = new Set(["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"]);
const statusName: Record<string, string> = { new: "Novo", distributed: "Aguardando contato", in_contact: "Em atendimento", quote_sent: "Cotação enviada", negotiation: "Negociação", documentation_pending: "Documentação", under_analysis: "Em análise" };

type Bucket = "late" | "waiting" | "service" | "stalled";

export function classifyRadarLead(lead: RadarLead, now: Date, slaMinutes: number): Bucket {
  const age = lead.assignedAt ? Math.max(0, now.getTime() - new Date(lead.assignedAt).getTime()) : 0;
  if (!lead.firstContactAt && age > slaMinutes * 60_000) return "late";
  if (!lead.firstContactAt) return "waiting";
  if (serviceStatuses.has(lead.status) && lead.stageEnteredAt && now.getTime() - new Date(lead.stageEnteredAt).getTime() > 3 * 86_400_000) return "stalled";
  return "service";
}

function since(value: string | null | undefined, now: Date) {
  if (!value) return "agora";
  const minutes = Math.max(1, Math.floor((now.getTime() - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 dia" : `${days} dias`;
}

type Alert = { kind: "late" | "client" | "task" | "stalled"; tone: BadgeTone; chip: string; text: string };

/** Everything that needs the manager's eye on one lead, most urgent first. */
export function leadAlerts(lead: RadarLead, bucket: Bucket, now: Date): Alert[] {
  const alerts: Alert[] = [];
  if (bucket === "late") alerts.push({ kind: "late", tone: "danger", chip: "Atrasado", text: `Sem primeiro contato há ${since(lead.assignedAt, now)}` });
  if (lead.clientWaitingSince) alerts.push({ kind: "client", tone: "info", chip: "Cliente esperando", text: `O cliente respondeu há ${since(lead.clientWaitingSince, now)} e aguarda` });
  if (lead.overdueTasks) alerts.push({ kind: "task", tone: "warning", chip: "Tarefa vencida", text: lead.overdueTasks === 1 ? "1 tarefa vencida" : `${lead.overdueTasks} tarefas vencidas` });
  if (bucket === "stalled") alerts.push({ kind: "stalled", tone: "warning", chip: "Parado", text: `Na mesma etapa há ${since(lead.stageEnteredAt, now)}` });
  return alerts;
}

type Tab = "attention" | "new" | "service" | "all";
const TAB_LABEL: Record<Tab, string> = { attention: "Atenção", new: "Novos", service: "Atendendo", all: "Abertos" };
const EMPTY_COPY: Record<Tab, { title: string; description: string }> = {
  attention: { title: "Nenhum alerta agora", description: "Atrasos, clientes esperando, tarefas vencidas e leads parados aparecem aqui." },
  new: { title: "Nenhum lead esperando contato", description: "Os leads que chegarem aparecem aqui até o primeiro contato." },
  service: { title: "Nenhum atendimento em andamento", description: "Depois do primeiro contato, o lead passa para cá." },
  all: { title: "Nenhum lead aberto", description: "Quando os corretores receberem leads, eles aparecem aqui." },
};
const SEVERITY: Record<Alert["kind"], number> = { late: 0, client: 1, task: 2, stalled: 3 };

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
const tagStyle = (tag: RadarTag) => ({ "--hue": tag.colorHue ?? 220 }) as CSSProperties;

const TIME_ZONE = "America/Sao_Paulo";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const weekdayFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, weekday: "long", day: "2-digit", month: "2-digit" });

function dayLabel(date: Date, now: Date) {
  const key = dayKey.format(date);
  if (key === dayKey.format(now)) return "Hoje";
  if (key === dayKey.format(new Date(now.getTime() - 86_400_000))) return "Ontem";
  const label = weekdayFormat.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function Tags({ tags, max = 2 }: { tags?: RadarTag[]; max?: number }) {
  if (!tags?.length) return null;
  const rest = tags.length - max;
  return (
    <span className={styles.tags}>
      {tags.slice(0, max).map((tag) => <span key={tag.id} className={styles.tag} style={tagStyle(tag)}>{tag.name}</span>)}
      {rest > 0 ? <span className={styles.tagMore} aria-label={`mais ${rest} tags`}>+{rest}</span> : null}
    </span>
  );
}

type Item = { lead: RadarLead; bucket: Bucket; alerts: Alert[] };

/**
 * The manager's (unit) or supervisor's (team) lead list, in the same shape as the broker's queue:
 * a tab with what needs attention now as cards, and the rest grouped by the day it arrived.
 */
export function SupervisorLeadsRadar({ data, now, search = "", audience = "supervisor", initialTab }: { initialTab?: Tab; data: { team: RadarTeamMember[]; leads: RadarLead[]; funnel: RadarFunnel; slaMinutes: number }; now: string; search?: string; audience?: "supervisor" | "manager" }) {
  const isManager = audience === "manager";
  const currentTime = useMemo(() => new Date(now), [now]);
  const [query, setQuery] = useState(search);
  const [brokerId, setBrokerId] = useState<string | null>(null);
  const [tagId, setTagId] = useState<string | null>(null);

  const items = useMemo<Item[]>(() => data.leads.map((lead) => {
    const bucket = classifyRadarLead(lead, currentTime, data.slaMinutes);
    return { lead, bucket, alerts: leadAlerts(lead, bucket, currentTime) };
  }), [data.leads, data.slaMinutes, currentTime]);

  // Broker, tag and search narrow every tab, so the tab counts follow them.
  const scoped = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return items.filter(({ lead }) => (!brokerId || lead.ownerId === brokerId)
      && (!tagId || lead.tags?.some((tag) => tag.id === tagId))
      && (!term || `${lead.name} ${lead.phone ?? ""} ${lead.ownerName} ${lead.productName ?? ""}`.toLocaleLowerCase("pt-BR").includes(term)));
  }, [items, brokerId, tagId, query]);

  const byTab = useMemo<Record<Tab, Item[]>>(() => ({
    attention: scoped.filter((item) => item.alerts.length > 0)
      .sort((a, b) => SEVERITY[a.alerts[0]!.kind] - SEVERITY[b.alerts[0]!.kind] || new Date(a.lead.assignedAt ?? 0).getTime() - new Date(b.lead.assignedAt ?? 0).getTime()),
    new: scoped.filter((item) => !item.lead.firstContactAt),
    service: scoped.filter((item) => Boolean(item.lead.firstContactAt)),
    all: scoped,
  }), [scoped]);

  const attentionTotal = items.filter((item) => item.alerts.length > 0).length;
  const [tab, setTab] = useState<Tab>(() => initialTab ?? (attentionTotal > 0 ? "attention" : "all"));
  const visible = byTab[tab];

  const tags = useMemo(() => {
    const seen = new Map<string, RadarTag & { total: number }>();
    for (const { lead } of items) for (const tag of lead.tags ?? []) seen.set(tag.id, { ...tag, total: (seen.get(tag.id)?.total ?? 0) + 1 });
    return [...seen.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"));
  }, [items]);

  const team = useMemo(() => [...data.team].sort((a, b) => b.late - a.late || b.openCount - a.openCount || a.name.localeCompare(b.name, "pt-BR")), [data.team]);
  const filtering = Boolean(query.trim() || brokerId || tagId);
  const clear = () => { setQuery(""); setBrokerId(null); setTagId(null); };

  const groups = useMemo(() => {
    const sorted = [...visible].sort((a, b) => new Date(b.lead.assignedAt ?? 0).getTime() - new Date(a.lead.assignedAt ?? 0).getTime());
    const result: Array<{ key: string; label: string; items: Item[] }> = [];
    for (const item of sorted) {
      const date = item.lead.assignedAt ? new Date(item.lead.assignedAt) : null;
      const key = date ? dayKey.format(date) : "sem-data";
      const last = result.at(-1);
      if (last?.key === key) last.items.push(item);
      else result.push({ key, label: date ? dayLabel(date, currentTime) : "Sem data", items: [item] });
    }
    return result;
  }, [visible, currentTime]);

  const options = (["attention", "new", "service", "all"] as const).map((value) => ({
    value,
    label: TAB_LABEL[value],
    accessory: byTab[value].length ? <span className={styles.tabCount} data-alert={value === "attention"}>{byTab[value].length}</span> : undefined,
  }));

  // Staggered entrance in CSS (nothing stays hidden before hydration).
  let order = 3;
  const enter = () => ({ "--i": Math.min(order++, 12) }) as CSSProperties;

  return (
    <div className={`arc-venancor ${styles.page}`}>
      <div className={styles.inner}>
        <header className={`${styles.header} ${styles.enter}`}>
          <h1>{isManager ? "Leads da unidade" : "Leads da equipe"}</h1>
          <p>
            {attentionTotal
              ? <><strong className={styles.alert}>{attentionTotal === 1 ? "1 lead precisa" : `${attentionTotal} leads precisam`} de você</strong> · {data.leads.length} em aberto</>
              : <>Tudo em dia · {data.leads.length === 1 ? "1 lead em aberto" : `${data.leads.length} leads em aberto`}</>}
          </p>
        </header>

        {team.length ? (
          <div className={`${styles.brokers} ${styles.enter}`} style={{ "--i": 1 } as CSSProperties} role="group" aria-label="Filtrar por corretor">
            <button type="button" className={styles.broker} aria-pressed={!brokerId} onClick={() => setBrokerId(null)}>
              <span className={styles.allIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9" r="2.6" /><path d="M15.5 14.2A4.6 4.6 0 0 1 21 18.5" /></svg>
              </span>
              Todos
            </button>
            {team.map((member) => (
              <button
                type="button"
                key={member.id}
                className={styles.broker}
                aria-pressed={brokerId === member.id}
                onClick={() => setBrokerId((current) => (current === member.id ? null : member.id))}
                aria-label={`${member.name}: ${member.openCount === 1 ? "1 lead aberto" : `${member.openCount} leads abertos`}${member.late ? `, ${member.late} atrasado${member.late === 1 ? "" : "s"}` : ""}`}
              >
                <Avatar name={member.name} src={member.image ?? undefined} size="sm" status={member.availability === "available" ? "online" : "offline"} />
                <span aria-hidden="true">{firstName(member.name)}</span>
                {member.openCount ? <span className={styles.brokerCount} data-late={member.late > 0} aria-hidden="true">{member.late || member.openCount}</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        <div className={`${styles.controls} ${styles.enter}`} style={{ "--i": 2 } as CSSProperties}>
          <SearchField label="Buscar lead ou corretor" placeholder="Nome, telefone, corretor ou produto" value={query} onValueChange={setQuery} />
          {tags.length ? (
            <div className={styles.tagFilter} role="group" aria-label="Filtrar por tag">
              {tags.map((tag) => (
                <button key={tag.id} type="button" className={styles.tagChip} style={tagStyle(tag)} aria-pressed={tagId === tag.id} onClick={() => setTagId((current) => (current === tag.id ? null : tag.id))}>
                  <i aria-hidden="true" />{tag.name}<span>{tag.total}</span>
                </button>
              ))}
            </div>
          ) : null}
          <SegmentedControl className={styles.segment} label="Situação dos leads" options={options} value={tab} onValueChange={(value) => setTab(value as Tab)} />
        </div>

        {filtering ? (
          <div className={styles.filterBar}>
            <span>{visible.length === 1 ? "1 lead" : `${visible.length} leads`} com esses filtros</span>
            <Button variant="ghost" size="sm" onClick={clear}>Limpar filtros</Button>
          </div>
        ) : null}

        {!visible.length ? (
          <EmptyState
            title={filtering ? "Nenhum lead com esses filtros" : EMPTY_COPY[tab].title}
            description={filtering ? "Troque o corretor, a tag ou a busca." : EMPTY_COPY[tab].description}
          />
        ) : tab === "attention" ? (
          <ul className={styles.cards} aria-label="Leads que precisam de você">
            {visible.map(({ lead, alerts }) => {
              const [main, ...others] = alerts;
              return (
                <li key={lead.id} className={`${styles.card} ${styles.enter}`} data-tone={main!.tone} style={enter()}>
                  <Link href={`/leads/${encodeURIComponent(lead.id)}`} className={styles.cardMain}>
                    <Avatar name={lead.name} size="lg" className="light-avatar" />
                    <span className={styles.cardText}>
                      <strong>{lead.name}</strong>
                      <span className={styles.alertText}>{main!.text}</span>
                      <span className={styles.muted}>{[lead.ownerId ? firstName(lead.ownerName) : "Sem corretor", statusName[lead.status] ?? "Em andamento", lead.productName].filter(Boolean).join(" · ")}</span>
                    </span>
                    <Badge tone={main!.tone}>{main!.chip}</Badge>
                  </Link>
                  {others.length || lead.tags?.length ? (
                    <div className={styles.cardExtra}>
                      {others.map((alert) => <Badge key={alert.kind} tone={alert.tone} size="sm">{alert.chip}</Badge>)}
                      <Tags tags={lead.tags} max={3} />
                    </div>
                  ) : null}
                  {isManager ? (
                    lead.clientWaitingSince ? <div className={styles.cardActions}><Link className={styles.secondary} href={`/mensagens/${encodeURIComponent(lead.id)}`}>Ver conversa</Link></div> : null
                  ) : (
                    <div className={styles.cardActions}>
                      <Link className={styles.secondary} href={`/equipe/repassar?lead=${encodeURIComponent(lead.id)}`}>Repassar</Link>
                      {lead.ownerId ? <Link className={styles.primary} href={`/relacionamento?brokerId=${encodeURIComponent(lead.ownerId)}&leadId=${encodeURIComponent(lead.id)}&action=reminder`}>Cobrar {firstName(lead.ownerName)}</Link> : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          groups.map((group) => (
            <section key={group.key} className={styles.day} aria-label={group.label}>
              <h2 className={`${styles.dayTitle} ${styles.enter}`} style={enter()} suppressHydrationWarning>{group.label}<span>{group.items.length}</span></h2>
              <ul className={`${styles.rows} ${styles.enter}`} style={enter()}>
                {group.items.map(({ lead, bucket, alerts }) => {
                  const remaining = bucket === "waiting" && lead.assignedAt
                    ? Math.max(1, Math.ceil((new Date(lead.assignedAt).getTime() + data.slaMinutes * 60_000 - currentTime.getTime()) / 60_000))
                    : null;
                  const chip = alerts[0] ?? (bucket === "waiting"
                    ? { tone: "info" as BadgeTone, chip: "Novo" }
                    : { tone: "neutral" as BadgeTone, chip: statusName[lead.status] ?? "Em andamento" });
                  return (
                    <li key={lead.id}>
                      <Link href={`/leads/${encodeURIComponent(lead.id)}`} className={styles.row} data-tone={alerts[0]?.tone}>
                        <Avatar name={lead.name} size="md" className="light-avatar" />
                        <span className={styles.rowText}>
                          <span className={styles.rowName}>{lead.name}</span>
                          <span className={styles.rowLine}>
                            <span className={styles.muted}>{[lead.ownerId ? firstName(lead.ownerName) : "Sem corretor", remaining ? `${remaining} min para o 1º contato` : lead.productName].filter(Boolean).join(" · ")}</span>
                            <Tags tags={lead.tags} />
                          </span>
                        </span>
                        <span className={styles.rowMeta}>
                          {lead.assignedAt ? <time dateTime={lead.assignedAt} suppressHydrationWarning>{timeFormat.format(new Date(lead.assignedAt))}</time> : null}
                          <Badge tone={chip.tone} size="sm">{chip.chip}</Badge>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

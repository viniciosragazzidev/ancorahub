"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { ChipGroup } from "@/components/arc/chip-group/chip-group";
import { PeopleEmpty, PeopleFilters, PeoplePage, PeopleRow, PeopleSection } from "@/components/light/people-list/people-list";

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

const actionPill = "inline-flex h-10 items-center justify-center rounded-full bg-(--surface-muted) px-4 text-sm font-medium text-(--foreground) whitespace-nowrap";

type Item = { lead: RadarLead; bucket: Bucket; alerts: Alert[] };

function tagText(tags: RadarTag[] | undefined, max: number) {
  if (!tags?.length) return null;
  const rest = tags.length - max;
  return tags.slice(0, max).map((tag) => tag.name).join(", ") + (rest > 0 ? ` +${rest}` : "");
}

/** One lead in the phone-book list: the main alert as the chip, who has it, and the action that resolves it. */
function RadarRow({ item, index, isManager, slaMinutes, now }: { item: Item; index: number; isManager: boolean; slaMinutes: number; now: Date }) {
  const { lead, bucket, alerts } = item;
  const [main, ...others] = alerts;
  const owner = lead.ownerId ? firstName(lead.ownerName) : "Sem corretor";
  const remaining = bucket === "waiting" && lead.assignedAt
    ? Math.max(1, Math.ceil((new Date(lead.assignedAt).getTime() + slaMinutes * 60_000 - now.getTime()) / 60_000))
    : null;
  const chip = main ?? (bucket === "waiting"
    ? { tone: "info" as BadgeTone, chip: "Novo" }
    : { tone: "neutral" as BadgeTone, chip: statusName[lead.status] ?? "Em andamento" });
  const preview = [
    owner,
    main ? main.text : remaining ? `${remaining} min para o 1º contato` : lead.productName,
    others.length ? others.map((alert) => alert.chip).join(", ") : null,
    tagText(lead.tags, 2),
  ].filter(Boolean).join(" · ");
  const action = main
    ? isManager
      ? lead.clientWaitingSince ? <Link href={`/mensagens/${encodeURIComponent(lead.id)}`} className={actionPill}>Ver conversa</Link> : undefined
      : <span className="flex flex-wrap justify-end gap-2">
          <Link href={`/equipe/repassar?lead=${encodeURIComponent(lead.id)}`} className={actionPill}>Repassar</Link>
          {lead.ownerId ? <Link href={`/relacionamento?brokerId=${encodeURIComponent(lead.ownerId)}&leadId=${encodeURIComponent(lead.id)}&action=reminder`} className={actionPill}>Cobrar {owner}</Link> : null}
        </span>
    : undefined;
  return (
    <PeopleRow
      index={index}
      href={`/leads/${encodeURIComponent(lead.id)}`}
      name={lead.name}
      chip={<Badge tone={chip.tone} size="sm">{chip.chip}</Badge>}
      preview={preview}
      previewTone={main?.kind === "late" ? "alert" : main?.kind === "client" ? "waiting" : "muted"}
      meta={lead.assignedAt ? <time dateTime={lead.assignedAt} suppressHydrationWarning>{timeFormat.format(new Date(lead.assignedAt))}</time> : undefined}
      dot={main ? (main.kind === "late" ? "alert" : "waiting") : null}
      dotLabel={main ? main.chip : undefined}
      action={action}
    />
  );
}

/**
 * The manager's (unit) or supervisor's (team) lead list, built from the same Arc pieces as the
 * broker's queue: the phone-book list, what needs attention first, the rest grouped by the day it arrived.
 */
export function SupervisorLeadsRadar({ data, now, search = "", audience = "supervisor", initialTab }: { initialTab?: Tab; data: { team: RadarTeamMember[]; leads: RadarLead[]; funnel: RadarFunnel; slaMinutes: number }; now: string; search?: string; audience?: "supervisor" | "manager" }) {
  const isManager = audience === "manager";
  const currentTime = useMemo(() => new Date(now), [now]);
  const [query, setQuery] = useState(search);
  const [brokerIds, setBrokerIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const brokerId = brokerIds[0] ?? null;
  const tagId = tagIds[0] ?? null;

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

  const tagOptions = useMemo(() => {
    const seen = new Map<string, { value: string; label: string; total: number }>();
    for (const { lead } of items) for (const tag of lead.tags ?? []) {
      const current = seen.get(tag.id);
      seen.set(tag.id, { value: tag.id, label: tag.name, total: (current?.total ?? 0) + 1 });
    }
    return [...seen.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "pt-BR")).map(({ value, label }) => ({ value, label }));
  }, [items]);

  // Brokers with late leads first; the count in the chip is what the manager acts on.
  const brokerOptions = useMemo(() => [...data.team]
    .sort((a, b) => b.late - a.late || b.openCount - a.openCount || a.name.localeCompare(b.name, "pt-BR"))
    .map((member) => ({ value: member.id, label: member.late ? `${firstName(member.name)} · ${member.late} atrasado${member.late === 1 ? "" : "s"}` : `${firstName(member.name)} · ${member.openCount}` })), [data.team]);

  const filtering = Boolean(query.trim() || brokerId || tagId);
  const clear = () => { setQuery(""); setBrokerIds([]); setTagIds([]); };

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
    id: value,
    label: TAB_LABEL[value],
    count: byTab[value].length,
  }));

  return (
    <PeoplePage
      title={isManager ? "Leads da unidade" : "Leads da equipe"}
      subtitle={attentionTotal
        ? <><span className="font-medium text-(--danger)">{attentionTotal === 1 ? "1 lead precisa" : `${attentionTotal} leads precisam`} de você</span> · {data.leads.length} em aberto</>
        : `Tudo em dia · ${data.leads.length === 1 ? "1 lead em aberto" : `${data.leads.length} leads em aberto`}`}
    >
      <PeopleFilters label="Situação dos leads" options={options} value={tab} onChange={setTab} search={query} onSearch={setQuery} searchPlaceholder="Buscar por nome, telefone, corretor ou produto" searchLabel="Buscar lead" />

      {brokerOptions.length ? <ChipGroup label="Corretor" options={brokerOptions} value={brokerIds} onValueChange={setBrokerIds} maxVisible={6} /> : null}
      {tagOptions.length ? <ChipGroup label="Tags" options={tagOptions} value={tagIds} onValueChange={setTagIds} maxVisible={5} /> : null}

      {filtering ? (
        <div className="flex items-center justify-between gap-2 text-sm text-(--text-secondary)">
          <span>{visible.length === 1 ? "1 lead" : `${visible.length} leads`} com esses filtros</span>
          <Button variant="ghost" size="sm" onClick={clear}>Limpar filtros</Button>
        </div>
      ) : null}

      {!visible.length ? (
        <PeopleEmpty
          title={filtering ? "Nenhum lead com esses filtros" : EMPTY_COPY[tab].title}
          description={filtering ? "Troque o corretor, a tag ou a busca." : EMPTY_COPY[tab].description}
        />
      ) : tab === "attention" ? (
        <PeopleSection id="radar-attention" title="Precisa de você agora" count={visible.length} label="Leads que precisam de você">
          {visible.map((item, index) => <RadarRow key={item.lead.id} item={item} index={index} isManager={isManager} slaMinutes={data.slaMinutes} now={currentTime} />)}
        </PeopleSection>
      ) : (
        groups.map((group) => (
          <PeopleSection key={group.key} id={`radar-${group.key}`} title={group.label} count={group.items.length}>
            {group.items.map((item, index) => <RadarRow key={item.lead.id} item={item} index={index} isManager={isManager} slaMinutes={data.slaMinutes} now={currentTime} />)}
          </PeopleSection>
        ))
      )}
    </PeoplePage>
  );
}

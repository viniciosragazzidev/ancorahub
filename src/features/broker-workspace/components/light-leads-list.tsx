"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { SearchField } from "@/components/arc/search-field/search-field";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { LightAvailabilityBanner } from "@/features/broker-workspace/components/light-availability-banner";
import { AcceptLeadButton } from "@/features/broker-workspace/components/accept-lead-button";

export type LightLeadItem = {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  qualificationStatus?: string | null;
  productName?: string | null;
  livesCount?: number | null;
  city?: string | null;
  summary?: string | null;
  createdAt: Date | string;
  /** When the lead reached the broker; the queue groups by its day and shows its time. */
  arrivedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  dueAt?: Date | string | null;
  isOverdue?: boolean;
  isAwaitingResponse?: boolean;
  isAwaitingAcceptance?: boolean;
  /** First-contact SLA overdue or inside its last window (new or already accepted). */
  isSlaAtRisk?: boolean;
  isLost?: boolean;
  lostReason?: string | null;
  /** The plantão that handed the lead out ("PME", "PRESENCIAL TARDE"). */
  dutyName?: string | null;
};

type FilterTab = "new" | "active" | "returns" | "risk" | "closed";

const ACTIVE_STATUSES = ["in_contact", "quote_sent", "negotiation", "documentation_pending"];

const isLostLead = (lead: LightLeadItem) => lead.status === "lost" || Boolean(lead.isLost);
const isNewLead = (lead: LightLeadItem) =>
  (Boolean(lead.isAwaitingAcceptance) || lead.status === "distributed" || lead.status === "new") && !isLostLead(lead);
const isWonLead = (lead: LightLeadItem) => lead.status === "converted" && !isLostLead(lead);
const isActiveLead = (lead: LightLeadItem) => !isLostLead(lead) && ACTIVE_STATUSES.includes(lead.status);
const isReturnLead = (lead: LightLeadItem) =>
  !isLostLead(lead) && !isWonLead(lead) && !isNewLead(lead) && (Boolean(lead.isOverdue) || Boolean(lead.dueAt));
const isRiskLead = (lead: LightLeadItem) => !isLostLead(lead) && !isWonLead(lead) && Boolean(lead.isSlaAtRisk);
const needsYouNow = (lead: LightLeadItem) =>
  !isLostLead(lead) && !isWonLead(lead) && (isNewLead(lead) || Boolean(lead.isAwaitingResponse) || Boolean(lead.isOverdue) || Boolean(lead.isSlaAtRisk));

const TAB_FILTERS: Record<FilterTab, (lead: LightLeadItem) => boolean> = {
  new: isNewLead,
  active: isActiveLead,
  returns: isReturnLead,
  risk: isRiskLead,
  closed: (lead) => isWonLead(lead) || isLostLead(lead),
};

const QUERY_FILTERS: Record<string, FilterTab> = { awaiting: "new", new: "new", active: "active", returns: "returns", risk: "risk", closed: "closed", finished: "closed", lost: "closed" };

const EMPTY_COPY: Record<FilterTab, { title: string; description: string }> = {
  new: { title: "Nenhum lead novo", description: "Fique disponível no plantão para receber os próximos leads." },
  active: { title: "Nenhum atendimento em andamento", description: "Aceite um lead novo para começar um atendimento." },
  returns: { title: "Nenhum retorno pendente", description: "Leads sem atualização há mais de 3 dias aparecem aqui." },
  risk: { title: "Nenhum lead com prazo em risco", description: "Leads sem primeiro contato perto do limite aparecem aqui." },
  closed: { title: "Nada fechado ainda", description: "Vendas concluídas e leads perdidos aparecem aqui." },
};

const STATUS_LABEL: Record<string, string> = {
  in_contact: "Em atendimento",
  quote_sent: "Cotação enviada",
  negotiation: "Em negociação",
  documentation_pending: "Documentação pendente",
  under_analysis: "Em análise",
};

type LeadState = { tone: BadgeTone; chip: string; context: string };

/** "Aguardando seu aceite · PME": which plantão the lead came from. */
const withDuty = (context: string, lead: LightLeadItem) => (lead.dutyName ? `${context} · ${lead.dutyName}` : context);

function describeLead(lead: LightLeadItem): LeadState {
  if (isLostLead(lead)) return { tone: "neutral", chip: "Perdido", context: lead.lostReason || "Marcado como perdido" };
  if (isWonLead(lead)) return { tone: "success", chip: "Venda concluída", context: "Venda concluída" };
  if (isNewLead(lead)) return { tone: "info", chip: "Novo", context: "Aguardando seu aceite" };
  if (lead.isAwaitingResponse) return { tone: "success", chip: "Respondeu", context: "O cliente respondeu e aguarda você" };
  if (lead.isSlaAtRisk) return { tone: "warning", chip: "Prazo em risco", context: "Primeiro contato pendente" };
  if (lead.isOverdue) return { tone: "warning", chip: "Atrasado", context: "Sem atualização há mais de 3 dias" };
  const stage = STATUS_LABEL[lead.status] ?? "Em andamento";
  return { tone: "neutral", chip: stage, context: lead.productName ? `${lead.productName}${lead.city ? ` em ${lead.city}` : ""}` : stage };
}

const actionPrimary =
  "inline-flex h-11 w-full items-center justify-center rounded-full bg-(--accent) px-5 text-sm font-semibold text-(--accent-foreground) disabled:opacity-60 sm:w-auto";
const actionSecondary =
  "inline-flex h-11 w-full items-center justify-center rounded-full bg-(--surface-muted) px-5 text-sm font-semibold text-(--foreground) sm:w-auto";

const TIME_ZONE = "America/Sao_Paulo";
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const weekdayFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, weekday: "long", day: "2-digit", month: "2-digit" });

function arrival(lead: LightLeadItem) {
  const value = lead.arrivedAt ?? lead.createdAt;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayLabel(date: Date, now: Date) {
  const key = dayKeyFormat.format(date);
  if (key === dayKeyFormat.format(now)) return "Hoje";
  if (key === dayKeyFormat.format(new Date(now.getTime() - 86_400_000))) return "Ontem";
  const label = weekdayFormat.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Leads grouped by the day they arrived, newest first, each day newest first. */
function groupByArrival(leads: LightLeadItem[], now: Date) {
  const sorted = [...leads].sort((a, b) => (arrival(b)?.getTime() ?? 0) - (arrival(a)?.getTime() ?? 0));
  const groups: Array<{ key: string; label: string; leads: LightLeadItem[] }> = [];
  for (const lead of sorted) {
    const date = arrival(lead);
    const key = date ? dayKeyFormat.format(date) : "sem-data";
    const last = groups.at(-1);
    if (last?.key === key) last.leads.push(lead);
    else groups.push({ key, label: date ? dayLabel(date, now) : "Sem data", leads: [lead] });
  }
  return groups;
}

/** "Chegou hoje às 14:32", "Chegou ontem às 09:10", "Chegou sexta, 09/10 às 18:00". */
function arrivalPhrase(lead: LightLeadItem) {
  const date = arrival(lead);
  if (!date) return null;
  const day = dayLabel(date, new Date());
  const when = day === "Hoje" || day === "Ontem" ? day.toLowerCase() : day.split(",")[0]?.toLowerCase() + "," + (day.split(",")[1] ?? "");
  return `Chegou ${when} às ${timeFormat.format(date)}`;
}

function ArrivalTime({ lead }: { lead: LightLeadItem }) {
  const date = arrival(lead);
  if (!date) return null;
  return (
    <time dateTime={date.toISOString()} className="shrink-0 text-xs tabular-nums text-(--text-muted)" suppressHydrationWarning>
      <span className="sr-only">Chegou às </span>{timeFormat.format(date)}
    </time>
  );
}

function NeedsYouCard({ lead, dataTour }: { lead: LightLeadItem; dataTour?: string }) {
  const state = describeLead(lead);
  return (
    <li data-tour={dataTour} className="flex flex-col gap-4 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
      <div className="flex items-start gap-3">
        <Avatar name={lead.name} size="lg" className="light-avatar" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-(--foreground)">{lead.name}</p>
          <p className="mt-0.5 text-sm text-(--text-secondary)">{withDuty(state.context, lead)}</p>
          <p className="mt-0.5 text-xs text-(--text-muted)" suppressHydrationWarning>{arrivalPhrase(lead)}</p>
        </div>
        <Badge tone={state.tone}>{state.chip}</Badge>
      </div>
      {isNewLead(lead) ? (
        <AcceptLeadButton leadId={lead.id} className={actionPrimary}>
          Aceitar lead
        </AcceptLeadButton>
      ) : (
        <Link
          href={lead.isAwaitingResponse ? `/conversas/broker?leadId=${lead.id}` : `/leads/${lead.id}`}
          className={actionSecondary}
        >
          {lead.isAwaitingResponse ? "Ver conversa" : "Atualizar etapa"}
        </Link>
      )}
    </li>
  );
}

function CompactRow({ lead, dataTour }: { lead: LightLeadItem; dataTour?: string }) {
  const state = describeLead(lead);
  return (
    <li data-tour={dataTour} className="border-b border-(--border) last:border-b-0">
      <Link href={`/leads/${lead.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-(--surface-muted)">
        <Avatar name={lead.name} size="md" className="light-avatar" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-(--foreground)">{lead.name}</span>
          <span className="block truncate text-sm text-(--text-secondary)">{withDuty(state.context, lead)}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <ArrivalTime lead={lead} />
          <Badge tone={state.tone} size="sm">{state.chip}</Badge>
        </span>
      </Link>
    </li>
  );
}

export function LightLeadsList({
  leads,
  initialFilter,
  availabilityStatus = "available",
}: {
  leads: LightLeadItem[];
  initialFilter?: FilterTab;
  availabilityStatus?: "available" | "paused" | "offline";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = QUERY_FILTERS[searchParams.get("filter") ?? ""];
  const [filter, setFilter] = useState<FilterTab>(() => requested ?? initialFilter ?? (leads.some(isNewLead) ? "new" : "active"));
  const [searchQuery, setSearchQuery] = useState("");

  const counts = useMemo(
    () => ({
      new: leads.filter(TAB_FILTERS.new).length,
      active: leads.filter(TAB_FILTERS.active).length,
      returns: leads.filter(TAB_FILTERS.returns).length,
      risk: leads.filter(TAB_FILTERS.risk).length,
      closed: leads.filter(TAB_FILTERS.closed).length,
    }),
    [leads],
  );

  const visible = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return leads
      .filter(TAB_FILTERS[filter])
      .filter(
        (lead) =>
          !query ||
          lead.name.toLowerCase().includes(query) ||
          Boolean(lead.phone && lead.phone.includes(query)) ||
          Boolean(lead.productName && lead.productName.toLowerCase().includes(query)),
      );
  }, [leads, filter, searchQuery]);

  // Newest arrival first (today's leads on top), not the order the leads were created.
  const urgent = filter === "closed" ? [] : visible.filter(needsYouNow).sort((a, b) => (arrival(b)?.getTime() ?? 0) - (arrival(a)?.getTime() ?? 0));
  const rest = filter === "closed" ? visible : visible.filter((lead) => !needsYouNow(lead));
  const searching = searchQuery.trim().length > 0;

  // "Em risco" only takes room in the bar while there is something at risk (or the broker came from the Inicio card).
  const tabs = (["new", "active", "returns", "risk", "closed"] as const).filter((value) => value !== "risk" || counts.risk > 0 || filter === "risk");
  const options = tabs.map((value) => ({
    value,
    label: { new: "Novos", active: "Atendendo", returns: "Retornos", risk: "Em risco", closed: "Fechados" }[value],
    accessory: counts[value] > 0 ? <span className="tabular-nums">{counts[value]}</span> : undefined,
  }));

  return (
    <div className="flex min-h-full flex-col text-foreground">
      <LightAvailabilityBanner initialStatus={availabilityStatus} />

      <div className="arc-venancor mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pb-6 pt-2 sm:px-6">
        <div data-tour="micro-queue-search"><SearchField
          label="Buscar lead"
          placeholder="Nome, telefone ou produto"
          value={searchQuery}
          onValueChange={setSearchQuery}
        /></div>

        <div data-tour="micro-queue-tabs"><SegmentedControl
          label="Etapas da fila"
          options={options}
          value={filter}
          onValueChange={(value) => setFilter(value as FilterTab)}
        /></div>

        {visible.length === 0 ? (
          <EmptyState
            title={searching ? `Não encontramos nenhum lead com "${searchQuery.trim()}"` : EMPTY_COPY[filter].title}
            description={searching ? "Confira o nome ou telefone, ou limpe a busca para ver sua lista." : EMPTY_COPY[filter].description}
            action={
              searching ? (
                <Button variant="secondary" onClick={() => setSearchQuery("")}>
                  Limpar busca
                </Button>
              ) : filter === "new" ? (
                <Button variant="secondary" onClick={() => router.push("/plantoes")}>Ver plantões</Button>
              ) : filter === "active" ? (
                <Button variant="secondary" onClick={() => router.push("/minha-fila?filter=new")}>Ver leads novos</Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {urgent.length > 0 ? (
              <section aria-labelledby="needs-you-heading" className="flex flex-col gap-3">
                <h2 id="needs-you-heading" className="text-base font-semibold text-(--foreground)">
                  Precisa de você agora
                  <span className="ml-2 tabular-nums text-(--text-secondary)">{urgent.length}</span>
                </h2>
                <ul className="flex flex-col gap-3">
                  {urgent.map((lead, index) => (
                    <NeedsYouCard key={lead.id} lead={lead} dataTour={index === 0 ? "micro-queue-lead" : undefined} />
                  ))}
                </ul>
              </section>
            ) : null}

            {rest.length > 0 ? (
              <section aria-labelledby="rest-heading" className="flex flex-col gap-3">
                {urgent.length > 0 ? (
                  <h2 id="rest-heading" className="text-base font-semibold text-(--foreground)">
                    Demais atendimentos
                  </h2>
                ) : (
                  <h2 id="rest-heading" className="sr-only">
                    Atendimentos
                  </h2>
                )}
                {groupByArrival(rest, new Date()).map((group, groupIndex) => (
                  <div key={group.key} className="flex flex-col gap-2">
                    <h3 className="px-1 text-sm font-medium text-(--text-secondary)" suppressHydrationWarning>
                      {group.label}
                      <span className="ml-2 tabular-nums text-(--text-muted)">{group.leads.length}</span>
                    </h3>
                    <ul className="overflow-hidden rounded-3xl bg-(--surface) shadow-(--shadow-resting)">
                      {group.leads.map((lead, index) => (
                        <CompactRow key={lead.id} lead={lead} dataTour={urgent.length === 0 && groupIndex === 0 && index === 0 ? "micro-queue-lead" : undefined} />
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

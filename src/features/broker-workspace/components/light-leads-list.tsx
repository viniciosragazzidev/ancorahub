"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { motionTokens } from "@/components/arc/motion-tokens";
import { PeopleEmpty, PeopleFilters, PeoplePage, PeopleRow, PeopleSection } from "@/components/light/people-list/people-list";
import { LightAvailabilityBanner } from "@/features/broker-workspace/components/light-availability-banner";
import { AcceptLeadButton } from "@/features/broker-workspace/components/accept-lead-button";
import { formatBrokerArrival, isBrokerArrivalToday } from "@/features/broker-workspace/arrival";
import styles from "./light-leads-list.module.css";

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
  expiresAt?: Date | string | null;
  awaitingResponseAt?: Date | string | null;
  isOverdue?: boolean;
  isOverdueReturn?: boolean;
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

const acceptButton =
  "inline-flex h-11 items-center justify-center rounded-full bg-(--accent) px-4 text-sm font-semibold text-(--accent-foreground) disabled:opacity-60";

function arrival(lead: LightLeadItem) {
  const value = lead.arrivedAt;
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Orders by distribution to this broker; brokerage capture dates never affect the client-facing list. */
function sortByArrival(leads: LightLeadItem[]) {
  return [...leads].sort((a, b) => {
    const left = arrival(a)?.getTime();
    const right = arrival(b)?.getTime();
    if (left === undefined && right === undefined) return a.name.localeCompare(b.name);
    if (left === undefined) return 1;
    if (right === undefined) return -1;
    return right - left;
  });
}

export type LeadNowItem = { kind: "acceptance" | "response" | "return"; lead: LightLeadItem };

export function buildLeadNowItems(leads: LightLeadItem[], now = new Date()): LeadNowItem[] {
  const current = leads.filter((lead) => !isLostLead(lead) && !isWonLead(lead));
  const acceptance = current
    .filter((lead) => isNewLead(lead) && (!lead.expiresAt || new Date(lead.expiresAt).getTime() > now.getTime()))
    .sort((a, b) => {
      const left = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.POSITIVE_INFINITY;
      const right = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.POSITIVE_INFINITY;
      return left - right;
    })[0];
  const response = current
    .filter((lead) => isActiveLead(lead) && lead.isAwaitingResponse)
    .sort((a, b) => new Date(b.awaitingResponseAt ?? 0).getTime() - new Date(a.awaitingResponseAt ?? 0).getTime())[0];
  const overdueReturn = current
    .filter((lead) => lead.isOverdueReturn && lead.dueAt && new Date(lead.dueAt).getTime() <= now.getTime())
    .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())[0];
  return [
    ...(acceptance ? [{ kind: "acceptance" as const, lead: acceptance }] : []),
    ...(response ? [{ kind: "response" as const, lead: response }] : []),
    ...(overdueReturn ? [{ kind: "return" as const, lead: overdueReturn }] : []),
  ];
}

function countdown(expiresAt: Date | string, now: number) {
  const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
  if (seconds <= 0) return "Prazo encerrado";
  const minutes = Math.ceil(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `Aceite em até ${hours} h ${minutes % 60} min` : `Aceite em até ${minutes} min`;
}

function NowBlock({ items }: { items: LeadNowItem[] }) {
  const reduce = useReducedMotion();
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!items.length) return null;
  return (
    <motion.section className={styles.now} aria-label="Agora" initial={reduce ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: motionTokens.duration.standard, ease: motionTokens.ease.enter }}>
      <h2 className={styles.nowTitle}>Agora</h2>
      <ul className={styles.nowList}>
        {items.map(({ kind, lead }, index) => {
          const label = kind === "acceptance" ? "Aceite pendente" : kind === "response" ? "Cliente respondeu" : "Retorno vencido";
          const actionLabel = kind === "acceptance" ? "Aceitar" : kind === "response" ? "Responder" : "Ver retorno";
          const arrived = arrival(lead);
          const detail = kind === "acceptance"
            ? [arrived ? `Recebido ${formatBrokerArrival(arrived)}` : null, lead.dutyName ? `Plantão ${lead.dutyName}` : "Plantão de origem"].filter(Boolean).join(" · ")
            : kind === "response" ? "O cliente aguarda sua mensagem." : "O prazo combinado para falar com o cliente venceu.";
          return (
            <motion.li key={`${kind}-${lead.id}`} className={styles.nowItem} layout={!reduce} initial={reduce ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: motionTokens.duration.fast, delay: reduce ? 0 : index * motionTokens.stagger.item, ease: motionTokens.ease.enter }}>
              <div className={styles.nowCopy}>
                <strong>{lead.name}</strong>
                <span>{label} · {detail}</span>
                {kind === "acceptance" && lead.expiresAt ? <span className={styles.nowCountdown}>{countdown(lead.expiresAt, clock)}</span> : null}
              </div>
              {kind === "acceptance"
                ? <AcceptLeadButton leadId={lead.id} className={styles.nowAction}>{actionLabel}</AcceptLeadButton>
                : <Link className={styles.nowAction} href={`/leads/${lead.id}${kind === "return" ? "#tarefas" : ""}`}>{actionLabel}</Link>}
            </motion.li>
          );
        })}
      </ul>
    </motion.section>
  );
}

/** A lead in the phone-book list: who it is, where it stands and, when new, the accept button beside it. */
function LeadRow({ lead, index, dataTour }: { lead: LightLeadItem; index: number; dataTour?: string }) {
  const state = describeLead(lead);
  const urgent = needsYouNow(lead);
  return (
    <PeopleRow
      index={index}
      dataTour={dataTour}
      href={lead.isAwaitingResponse ? `/conversas/broker?leadId=${lead.id}` : `/leads/${lead.id}`}
      name={lead.name}
      chip={<Badge tone={state.tone} size="sm">{state.chip}</Badge>}
      preview={withDuty(state.context, lead)}
      previewTone={lead.isAwaitingResponse ? "waiting" : lead.isSlaAtRisk || lead.isOverdue ? "alert" : "muted"}
      meta={arrival(lead) ? <time className={styles.arrival} data-old={!isBrokerArrivalToday(arrival(lead)) ? "true" : "false"} dateTime={arrival(lead)!.toISOString()} suppressHydrationWarning>Recebido {formatBrokerArrival(arrival(lead))}</time> : undefined}
      dot={urgent ? (lead.isSlaAtRisk || lead.isOverdue ? "alert" : "waiting") : null}
      dotLabel={urgent ? "Precisa de você agora" : undefined}
      action={isNewLead(lead) ? <AcceptLeadButton leadId={lead.id} className={acceptButton}>Aceitar lead</AcceptLeadButton> : undefined}
    />
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
  const nowItems = useMemo(() => buildLeadNowItems(leads), [leads]);

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
  const urgent = filter === "closed" ? [] : sortByArrival(visible.filter(needsYouNow));
  const rest = filter === "closed" ? visible : visible.filter((lead) => !needsYouNow(lead));
  const searching = searchQuery.trim().length > 0;

  // "Em risco" only takes room in the bar while there is something at risk (or the broker came from the Inicio card).
  const tabs = (["new", "active", "returns", "risk", "closed"] as const).filter((value) => value !== "risk" || counts.risk > 0 || filter === "risk");
  const options = tabs.map((value) => ({
    id: value,
    label: { new: "Novos", active: "Atendendo", returns: "Retornos", risk: "Em risco", closed: "Fechados" }[value],
    count: counts[value],
  }));

  return (
    <div className="flex min-h-full flex-col text-foreground">
      <LightAvailabilityBanner initialStatus={availabilityStatus} />

      <PeoplePage>
        {filter !== "closed" && !searching ? <NowBlock items={nowItems} /> : null}
        <PeopleFilters
          label="Etapas da fila"
          options={options}
          value={filter}
          onChange={setFilter}
          search={searchQuery}
          onSearch={setSearchQuery}
          searchPlaceholder="Buscar por nome, telefone ou produto"
          searchLabel="Buscar lead"
          dataTourSegment="micro-queue-tabs"
          dataTourSearch="micro-queue-search"
        />

        {visible.length === 0 ? (
          <PeopleEmpty
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
              <PeopleSection id="needs-you-heading" title="Precisa de você agora" count={urgent.length}>
                {urgent.map((lead, index) => (
                  <LeadRow key={lead.id} lead={lead} index={index} dataTour={index === 0 ? "micro-queue-lead" : undefined} />
                ))}
              </PeopleSection>
            ) : null}

            {rest.length > 0 ? (
              <PeopleSection id="rest-heading" title={urgent.length > 0 ? "Demais atendimentos" : undefined}>
                {sortByArrival(rest).map((lead, index) => (
                  <LeadRow key={lead.id} lead={lead} index={urgent.length + index} dataTour={urgent.length === 0 && index === 0 ? "micro-queue-lead" : undefined} />
                ))}
              </PeopleSection>
            ) : null}
          </>
        )}
      </PeoplePage>
    </div>
  );
}

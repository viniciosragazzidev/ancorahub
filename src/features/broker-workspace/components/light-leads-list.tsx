"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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
  updatedAt?: Date | string | null;
  dueAt?: Date | string | null;
  isOverdue?: boolean;
  isAwaitingResponse?: boolean;
  isAwaitingAcceptance?: boolean;
  /** First-contact SLA overdue or inside its last window (new or already accepted). */
  isSlaAtRisk?: boolean;
  isLost?: boolean;
  lostReason?: string | null;
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
  new: { title: "Nenhum lead novo", description: "Quando um lead chegar para você, ele aparece aqui." },
  active: { title: "Nenhum atendimento em andamento", description: "Leads aceitos ficam aqui até serem fechados." },
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

function describeLead(lead: LightLeadItem): LeadState {
  if (isLostLead(lead)) return { tone: "neutral", chip: "Perdido", context: lead.lostReason || "Redistribuído por inatividade" };
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

function NeedsYouCard({ lead }: { lead: LightLeadItem }) {
  const state = describeLead(lead);
  return (
    <li className="flex flex-col gap-4 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
      <div className="flex items-start gap-3">
        <Avatar name={lead.name} size="lg" className="light-avatar" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-(--foreground)">{lead.name}</p>
          <p className="mt-0.5 text-sm text-(--text-secondary)">{state.context}</p>
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

function CompactRow({ lead }: { lead: LightLeadItem }) {
  const state = describeLead(lead);
  return (
    <li className="border-b border-(--border) last:border-b-0">
      <Link href={`/leads/${lead.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-(--surface-muted)">
        <Avatar name={lead.name} size="md" className="light-avatar" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-(--foreground)">{lead.name}</span>
          <span className="block truncate text-sm text-(--text-secondary)">{state.context}</span>
        </span>
        <Badge tone={state.tone} size="sm">{state.chip}</Badge>
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

  const urgent = filter === "closed" ? [] : visible.filter(needsYouNow);
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
        <SearchField
          label="Buscar lead"
          placeholder="Nome, telefone ou produto"
          value={searchQuery}
          onValueChange={setSearchQuery}
        />

        <SegmentedControl
          label="Etapas da fila"
          options={options}
          value={filter}
          onValueChange={(value) => setFilter(value as FilterTab)}
        />

        {visible.length === 0 ? (
          <EmptyState
            title={searching ? `Nenhum resultado para "${searchQuery.trim()}"` : EMPTY_COPY[filter].title}
            description={searching ? "Tente outro nome, telefone ou produto." : EMPTY_COPY[filter].description}
            action={
              searching ? (
                <Button variant="secondary" onClick={() => setSearchQuery("")}>
                  Limpar busca
                </Button>
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
                  {urgent.map((lead) => (
                    <NeedsYouCard key={lead.id} lead={lead} />
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
                <ul className="overflow-hidden rounded-3xl bg-(--surface) shadow-(--shadow-resting)">
                  {rest.map((lead) => (
                    <CompactRow key={lead.id} lead={lead} />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

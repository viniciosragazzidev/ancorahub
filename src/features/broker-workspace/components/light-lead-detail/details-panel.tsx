"use client";

import { ChevronDown } from "lucide-react";

import { AiConversationInsightCard } from "@/features/conversation-intelligence/components/ai-conversation-insight-card";
import { cn } from "@/lib/utils";

import type { LightLeadDetailData } from "./types";
import type { LeadDetailController } from "./use-lead-detail";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-(--text-secondary)">{label}</dt>
      <dd className="truncate text-sm font-medium text-(--foreground)">{value}</dd>
    </div>
  );
}

/** Collapsible lead facts, attendance summary and the AI conversation diagnostic. */
export function DetailsZone({ lead, c }: { lead: LightLeadDetailData; c: LeadDetailController }) {
  const { detailsExpanded, setDetailsExpanded } = c;
  const product = lead.planName || lead.carrierName || lead.clientInfo?.find((item) => item.key === "planType")?.value || "Não informado";
  const leadType = lead.tipo === "PJ" || lead.tipo === "PME" ? "Pessoa jurídica (PJ ou PME)" : "Pessoa física (PF)";

  return (
    <>
      <section className="arc-venancor rounded-3xl bg-(--surface) shadow-(--shadow-resting)">
        <button
          type="button"
          onClick={() => setDetailsExpanded((previous) => !previous)}
          aria-expanded={detailsExpanded}
          aria-controls="lead-details-panel"
          className="flex min-h-14 w-full items-center justify-between gap-3 px-5 text-left text-sm font-medium text-(--foreground)"
        >
          <span>{detailsExpanded ? "Ocultar detalhes do lead" : "Ver detalhes do lead"}</span>
          <ChevronDown
            className={cn("size-4 text-(--text-muted) transition-transform duration-(--duration-fast) motion-reduce:transition-none", detailsExpanded && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        {detailsExpanded ? (
          <div id="lead-details-panel" className="flex flex-col gap-4 border-t border-(--border) p-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Fact label="Produto ou plano" value={product} />
              <Fact label="Tipo de lead" value={leadType} />
              {lead.tipoCnpj ? <Fact label="Tipo de CNPJ" value={lead.tipoCnpj} /> : null}
              <Fact label="Origem ou campanha" value={lead.sourceCampaign || (lead.origem === "manual" ? "Manual" : "Webhook ou Meta")} />
              <Fact label="Cidade ou filial" value={lead.city || lead.branchName || "Não informada"} />
              <Fact label="Data de entrada" value={new Date(lead.createdAt).toLocaleDateString("pt-BR")} />
              <Fact label="Consentimento LGPD" value={lead.consentimentoLgpd ? "Confirmado" : "Não registrado"} />
            </dl>
            {lead.summary ? (
              <div>
                <h3 className="text-sm font-semibold text-(--foreground)">Resumo do atendimento</h3>
                <p className="mt-1 text-sm leading-relaxed text-(--text-secondary)">{lead.summary}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
      {detailsExpanded ? (
        <AiConversationInsightCard
          leadId={lead.id}
          assessment={lead.aiIntelligence}
          policyResult={lead.aiPolicyResult}
          canManage={lead.isCurrentBroker}
        />
      ) : null}
    </>
  );
}

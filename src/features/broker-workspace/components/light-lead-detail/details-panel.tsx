"use client";

import { AiConversationInsightCard } from "@/features/conversation-intelligence/components/ai-conversation-insight-card";
import { type LightLeadDetailData } from "./types";
import type { LeadDetailController } from "./use-lead-detail";

export function DetailsZone({ lead, c }: { lead: LightLeadDetailData; c: LeadDetailController }) {
  const { detailsExpanded, setDetailsExpanded } = c;
  return (
    <>
          {/* Zona C — Detalhes Colapsáveis */}
          <div className="pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={() => setDetailsExpanded((prev) => !prev)}
              aria-expanded={detailsExpanded}
              className="flex w-full items-center justify-between py-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <span>{detailsExpanded ? "Ocultar detalhes do lead" : "Ver detalhes do lead"}</span>
              <span className="text-xs">{detailsExpanded ? "▲" : "▼"}</span>
            </button>

            {detailsExpanded && (
              <div className="mt-3 space-y-3 animate-in fade-in duration-200">
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/70 bg-muted/20 p-3.5 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Produto / Plano</span>
                    <strong className="font-semibold text-foreground truncate block">
                      {lead.planName || lead.carrierName || lead.clientInfo?.find((item) => item.key === "planType")?.value || "Não informado"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Tipo de Lead</span>
                    <strong className="font-semibold text-foreground truncate block">
                      {lead.tipo === "PJ" || lead.tipo === "PME" ? "PJ / PME (Pessoa Jurídica)" : "PF (Pessoa Física)"}
                    </strong>
                  </div>
                  {lead.tipoCnpj ? (
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Tipo de CNPJ</span>
                      <strong className="font-semibold text-foreground truncate block">{lead.tipoCnpj}</strong>
                    </div>
                  ) : null}

                  <div>
                    <span className="text-muted-foreground block text-[11px]">Origem / Campanha</span>
                    <strong className="font-semibold text-foreground truncate block">
                      {lead.sourceCampaign || (lead.origem === "manual" ? "Manual" : "Webhook / Meta")}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Cidade / Filial</span>
                    <strong className="font-semibold text-foreground truncate block">
                      {lead.city || lead.branchName || "Não informada"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Data de Entrada</span>
                    <strong className="font-semibold text-foreground truncate block">
                      {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Consentimento LGPD</span>
                    <strong className="font-semibold text-emerald-600 truncate block">
                      ✓ Confirmado
                    </strong>
                  </div>
                </div>

                {lead.summary ? (
                  <div className="rounded-xl border border-border/60 bg-card p-3 text-xs space-y-1">
                    <span className="font-semibold text-primary uppercase text-[10px] tracking-wider block">
                      Resumo do atendimento
                    </span>
                    <p className="text-muted-foreground leading-relaxed">{lead.summary}</p>
                  </div>
                ) : null}

                {/* AI Conversation Diagnostic */}
                <AiConversationInsightCard
                  leadId={lead.id}
                  assessment={lead.aiIntelligence}
                  policyResult={lead.aiPolicyResult}
                  canManage={lead.isCurrentBroker}
                />
              </div>
            )}
          </div>
    </>
  );
}

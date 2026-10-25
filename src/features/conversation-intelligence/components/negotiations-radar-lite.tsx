"use client";

/**
 * Radar IA no visual Lite do diretor: os mesmos contadores (que também filtram), a mesma busca e os filtros de unidade
 * e corretor, e um cartão por negociação com a leitura da IA, o risco, a resposta sugerida (copiar), reanalisar,
 * WhatsApp e a ficha. Mesmas ações e mensagens do Radar atual; só muda o visual.
 */
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowUpRight, Building2, Check, Copy, RefreshCw, Search, Sparkles, TriangleAlert, User } from "lucide-react";

import { toast } from "@/components/ui/sonner";
import { LiteSelect } from "@/components/lite/controls";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";

import { triggerManualConversationAnalysisAction } from "../actions";
import type { RadarDealItem } from "./negotiations-radar-tab";
import styles from "./negotiations-radar-lite.module.css";
import { enrichRadarLeads, filterRadarLeads, intentLabel, intentTone, radarStats, stageLabel, type RadarFilter } from "./radar-model";

export function NegotiationsRadarLite({ leads, branches = [], brokers = [], contextRole }: {
  leads: RadarDealItem[];
  branches?: Array<{ id: string; name: string }>;
  brokers?: Array<{ id: string; name: string; branchId: string | null }>;
  contextRole: string;
}) {
  const [type, setType] = useState<RadarFilter>("all");
  const [branch, setBranch] = useState("all");
  const [broker, setBroker] = useState("all");
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, startTransition] = useTransition();

  const enriched = useMemo(() => enrichRadarLeads(leads), [leads]);
  const stats = useMemo(() => radarStats(enriched), [enriched]);
  const visible = useMemo(() => filterRadarLeads(enriched, { type, branch, broker, query }), [enriched, type, branch, broker, query]);

  const copyScript = (leadId: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(leadId);
    toast.success("Script de orientação copiado para a área de transferência!");
    window.setTimeout(() => setCopiedId(null), 2500);
  };

  const reanalyze = (leadId: string) => {
    startTransition(async () => {
      toast.info("Atualizando leitura da conversa com IA...");
      const result = await triggerManualConversationAnalysisAction(leadId);
      if (result.success) toast.success("Diagnóstico da IA atualizado com sucesso!");
      else toast.error(result.error || "Falha ao analisar a conversa.");
    });
  };

  const kpis: { id: RadarFilter; label: string; hint: string; value: number; tone: "neutral" | "success" | "danger" | "warning" }[] = [
    { id: "all", label: "Total em negociação", hint: "Leads monitorados por IA", value: stats.total, tone: "neutral" },
    { id: "hot", label: "Fechamento iminente", hint: "Alta intenção de compra", value: stats.hotCount, tone: "success" },
    { id: "risk", label: "Risco de perda", hint: "Objeções severas ou atrito", value: stats.riskCount, tone: "danger" },
    { id: "broker_pending", label: "Pendente no corretor", hint: "Aguardando ação da equipe", value: stats.brokerPendingCount, tone: "warning" },
  ];

  return (
    <div className={`arc-venancor ${styles.root}`} data-skin="diretor">
      <div role="group" aria-label="Filtrar o radar" className={styles.kpis}>
        {kpis.map((kpi) => (
          <button key={kpi.id} type="button" className={styles.kpi} data-tone={kpi.tone} aria-pressed={type === kpi.id} onClick={() => setType(kpi.id)}>
            <span className={styles.kpiLabel}>{kpi.label}</span>
            <span className={styles.kpiValue}>{kpi.value.toLocaleString("pt-BR")}</span>
            <span className={styles.kpiHint}>{kpi.hint}</span>
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search aria-hidden="true" size={18} className={styles.searchIcon} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por cliente, corretor ou diagnóstico"
            aria-label="Buscar no radar"
            className={styles.searchInput}
          />
        </label>
        {branches.length > 0 && contextRole === "director" ? (
          <div className={styles.select}>
            <LiteSelect label="Unidade" hideLabel value={branch} onChange={setBranch} options={[{ value: "all", label: "Todas as unidades" }, ...branches.map((item) => ({ value: item.id, label: item.name }))]} />
          </div>
        ) : null}
        {brokers.length > 0 ? (
          <div className={styles.select}>
            <LiteSelect label="Corretor" hideLabel value={broker} onChange={setBroker} options={[{ value: "all", label: "Todos os corretores" }, ...brokers.map((item) => ({ value: item.id, label: item.name }))]} />
          </div>
        ) : null}
        <p className={styles.count} aria-live="polite">{visible.length} {visible.length === 1 ? "negociação" : "negociações"}</p>
      </div>

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <Sparkles aria-hidden="true" size={24} />
          <h3 className={styles.emptyTitle}>Nenhuma negociação encontrada</h3>
          <p className={styles.emptyText}>Não há negociações neste filtro. Quando o corretor e o cliente conversarem pelo WhatsApp, a IA atualiza o radar sozinha.</p>
        </div>
      ) : (
        <ul className={styles.cards}>
          {visible.map((lead) => {
            const whatsappUrl = lead.telefone ? buildWhatsAppUrl(lead.telefone) : null;
            const script = lead.nextBestAction || `Acompanhar negociação com ${lead.nome}.`;
            return (
              <li key={lead.id} className={styles.card} data-tone={lead.hasRisk ? "danger" : lead.isHot ? "success" : undefined}>
                <div className={styles.cardHead}>
                  <div className={styles.cardTitleBlock}>
                    <div className={styles.nameRow}>
                      <h4 className={styles.name} title={lead.nome}>{lead.nome}</h4>
                      <span className={styles.badge} data-tone={intentTone[lead.intent] ?? "neutral"}>{intentLabel[lead.intent] ?? "Intenção pendente"}</span>
                    </div>
                    <p className={styles.meta}>
                      {lead.corretorNome ? <span><User aria-hidden="true" size={14} />{lead.corretorNome}</span> : null}
                      {lead.branchName ? <span><Building2 aria-hidden="true" size={14} />{lead.branchName}</span> : null}
                      <span className={styles.stage}>Etapa: {stageLabel[lead.stage] ?? lead.status}</span>
                    </p>
                  </div>
                  <button type="button" className={styles.iconButton} aria-label={`Reanalisar conversa de ${lead.nome} com IA`} title="Reanalisar conversa com IA" disabled={isRefreshing} onClick={() => reanalyze(lead.id)}>
                    <RefreshCw aria-hidden="true" size={16} className={isRefreshing ? styles.spin : undefined} />
                  </button>
                </div>

                {lead.summary ? (
                  <div className={styles.block}>
                    <p className={styles.blockTitle}>Leitura comercial da IA</p>
                    <p>{lead.summary}</p>
                  </div>
                ) : (
                  <p className={styles.pending}>Aguardando novas mensagens para gerar o resumo da negociação.</p>
                )}

                {lead.riskReason ? (
                  <div className={styles.block} data-tone="danger">
                    <p className={styles.blockTitle}><TriangleAlert aria-hidden="true" size={14} />Alerta de risco para a supervisão</p>
                    <p>{lead.riskReason}</p>
                  </div>
                ) : null}

                {lead.nextBestAction ? (
                  <div className={styles.block} data-tone="accent">
                    <div className={styles.blockHead}>
                      <p className={styles.blockTitle}>Ação ou resposta sugerida</p>
                      <button type="button" className={styles.copy} onClick={() => copyScript(lead.id, script)}>
                        {copiedId === lead.id ? <><Check aria-hidden="true" size={14} />Copiado</> : <><Copy aria-hidden="true" size={14} />Copiar script</>}
                      </button>
                    </div>
                    <p>{lead.nextBestAction}</p>
                  </div>
                ) : null}

                <div className={styles.cardFoot}>
                  <p className={styles.footNote} data-tone={lead.isBrokerPending ? "warning" : undefined}>
                    {lead.isBrokerPending ? "Corretor precisa agir" : "Aguardando retorno do cliente"}
                  </p>
                  <div className={styles.footActions}>
                    {whatsappUrl ? (
                      <a href={whatsappUrl} target="_blank" rel="noreferrer" className={styles.secondary}>
                        WhatsApp
                        <ArrowUpRight aria-hidden="true" size={14} />
                      </a>
                    ) : null}
                    <Link href={`/leads/${lead.id}`} className={styles.secondary}>
                      Ver ficha
                      <ArrowUpRight aria-hidden="true" size={14} />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

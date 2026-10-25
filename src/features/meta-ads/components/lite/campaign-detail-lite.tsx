"use client";

/**
 * Detalhe da campanha no visual Lite (Onda 7): a mesma captura e fila (mesma Server Action e mesmas travas), o mesmo
 * resumo, os mesmos números, anúncios (ativos primeiro), formulários, parâmetros e funil. O nome da campanha fica no
 * topo do app; aqui entra só a linha de status.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { Switch } from "@/components/arc/switch/switch";
import { LiteSelect } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { saveMetaCampaignQueueRouteAction } from "@/features/lead-distribution/actions";
import { formatCurrency } from "@/features/quotes/utils";
import type { MetaCampaignItem } from "../../types";
import type { CampaignAdItem, CampaignFormItem } from "../campaign-detail-view";
import styles from "./meta-lite.module.css";
import detail from "./campaign-detail-lite.module.css";

const count = new Intl.NumberFormat("pt-BR");
const isActive = (status: string) => status === "ACTIVE" || status === "active";

export function CampaignDetailLite({
  campaign,
  ads = [],
  forms = [],
  queues = [],
  initialQueueId = null,
  initialCaptureEnabled = false,
  canConfigureCapture = false,
  canDisableCapture = false,
}: {
  campaign: MetaCampaignItem;
  ads?: CampaignAdItem[];
  forms?: CampaignFormItem[];
  queues?: Array<{ id: string; name: string; branchName?: string | null }>;
  initialQueueId?: string | null;
  initialCaptureEnabled?: boolean;
  canConfigureCapture?: boolean;
  canDisableCapture?: boolean;
}) {
  const router = useRouter();
  const [selectedQueueId, setSelectedQueueId] = useState<string>(initialQueueId ?? "");
  const [captureEnabled, setCaptureEnabled] = useState(initialCaptureEnabled);
  const [isSaving, setIsSaving] = useState(false);

  const leadsCount = campaign.leadsCount || 0;
  const conversationsCount = campaign.conversationsCount || 0;
  const salesCount = campaign.salesCount || 0;
  const revenueTotal = campaign.revenueTotal || 0;
  const conversionRate = campaign.conversionRate || 0;

  const sortedAds = useMemo(() => [...ads].sort((a, b) => {
    const aActive = isActive(a.status);
    const bActive = isActive(b.status);
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return b.leadsCount - a.leadsCount;
  }), [ads]);

  async function handleSaveQueue() {
    setIsSaving(true);
    try {
      const res = await saveMetaCampaignQueueRouteAction({ campaignId: campaign.campaignId, queueId: selectedQueueId || null, enabled: captureEnabled });
      if (res.success) {
        toast.success(res.message || "Fila de distribuição salva com sucesso!");
        router.refresh();
      } else {
        toast.error(res.error || "Erro ao salvar fila.");
      }
    } catch {
      toast.error("Ocorreu um erro ao salvar a fila da campanha.");
    } finally {
      setIsSaving(false);
    }
  }

  // Mesmo texto do resumo da tela atual.
  const aiSummaryText =
    conversionRate >= 10
      ? `A campanha "${campaign.name}" apresenta alta eficiência comercial com taxa de conversão de ${conversionRate}%. Recomendamos expandir o orçamento em +20% e manter o foco nos criativos atuais.`
      : conversionRate >= 5
      ? `Desempenho estável na campanha "${campaign.name}". Gerou ${leadsCount} leads e R$ ${revenueTotal.toLocaleString("pt-BR")} em receita vendida. Otimize os horários de distribuição para aumentar a agilidade de 1º contato.`
      : `Campanha "${campaign.name}" possui taxa de conversão em ${conversionRate}%. Há oportunidade de reengajar ${leadsCount - salesCount} leads com retorno pendente.`;

  const switchDisabled = !canConfigureCapture || isSaving || (captureEnabled && !canDisableCapture);
  const saveDisabled = !canConfigureCapture || isSaving || (captureEnabled && !selectedQueueId);
  const queueOptions = [
    { value: "", label: "Sem fila (captura pausada)" },
    ...queues.map((queue) => ({ value: queue.id, label: `${queue.name}${queue.branchName ? ` (${queue.branchName})` : ""}` })),
  ];
  const activeAds = ads.filter((ad) => isActive(ad.status)).length;

  const adColumns: LiteColumn<CampaignAdItem>[] = [
    { id: "name", label: "Nome do anúncio", primary: true, render: (ad) => <span className={page.cellTitle}>{ad.name}</span> },
    { id: "id", label: "ID do anúncio", render: (ad) => <span className={page.muted}>{ad.adId}</span> },
    { id: "status", label: "Status", render: (ad) => <span className={page.badge} data-tone={isActive(ad.status) ? "success" : undefined}>{isActive(ad.status) ? "Ativo" : "Pausado"}</span> },
    { id: "leads", label: "Leads capturados", numeric: true, render: (ad) => count.format(ad.leadsCount) },
  ];

  const funnel = [
    { stage: "Leads capturados", count: leadsCount, percent: "100%" },
    { stage: "Em atendimento", count: Math.round(leadsCount * 0.85), percent: "85%" },
    { stage: "Propostas criadas", count: Math.round(leadsCount * 0.35), percent: "35%" },
    { stage: "Vendas concluídas", count: salesCount, percent: `${conversionRate}%` },
  ];

  return (
    <>
      <div className={detail.statusRow}>
        <span className={page.badge} data-tone={isActive(campaign.status) ? "success" : undefined}>
          {campaign.status.trim().toUpperCase() === "ACTIVE" ? "Veiculação ativa na Meta" : `Veiculação Meta: ${campaign.status}`}
        </span>
        <span className={page.cellSub}>ID {campaign.campaignId} · Objetivo: {campaign.objective || "LEAD_GENERATION"}</span>
        <Link href="/marketing/campanhas" className={`${page.button} ${page.toolbarEnd}`}>
          <ArrowLeft aria-hidden="true" size={16} /> Voltar para campanhas
        </Link>
      </div>

      <section className={page.card} aria-labelledby="campaign-queue-title">
        <div className={page.cardHead}>
          <h2 id="campaign-queue-title" className={page.cardTitle}>Fila de distribuição dos leads</h2>
          <p className={page.cardDescription}>Defina para qual fila os novos leads gerados por esta campanha serão direcionados automaticamente.</p>
        </div>
        <div className={detail.settingRow}>
          <div className={page.cardHead}>
            <span className={page.cellTitle} id="campaign-capture-label">Captura no CRM</span>
            <span className={page.cellSub}>Anúncios e formulários desta campanha herdam esta configuração.</span>
          </div>
          <div className={detail.switchWrap}>
            <span className={page.muted}>{captureEnabled ? "Ativa" : "Pausada"}</span>
            <Switch
              checked={captureEnabled}
              disabled={switchDisabled}
              onCheckedChange={setCaptureEnabled}
              aria-label={captureEnabled ? "Pausar captura da campanha" : "Ativar captura da campanha"}
            />
          </div>
        </div>
        <div className={detail.settingRow}>
          <div className={page.cardHead}>
            <span className={page.cellTitle}>Fila alvo para envios de leads</span>
            <span className={page.cellSub}>A fila é obrigatória para ativar a captura. A atribuição da Meta permanece separada da fila de distribuição.</span>
          </div>
          <div className={styles.controlRow}>
            {canConfigureCapture ? (
              <div className={styles.controlSelect}>
                <LiteSelect label="Selecionar fila" hideLabel value={selectedQueueId} options={queueOptions} onChange={(value) => { if (!isSaving) setSelectedQueueId(value); }} />
              </div>
            ) : (
              <span className={page.muted}>{queueOptions.find((option) => option.value === selectedQueueId)?.label ?? "Sem fila"}</span>
            )}
            <button type="button" className={page.primaryButton} onClick={() => void handleSaveQueue()} disabled={saveDisabled}>
              {isSaving ? "Salvando..." : "Salvar configuração"}
            </button>
          </div>
        </div>
      </section>

      <section className={detail.summary} aria-labelledby="campaign-summary-title">
        <h2 id="campaign-summary-title" className={detail.summaryTitle}>Resumo de desempenho por IA</h2>
        <p className={page.cardDescription}>{aiSummaryText}</p>
      </section>

      <div className={page.stats}>
        <div className={page.stat}><span className={page.statLabel}>Leads gerados</span><span className={page.statValue}>{count.format(leadsCount)}</span><span className={page.statHint}>Captação direta Meta Ads</span></div>
        <div className={page.stat}><span className={page.statLabel}>Conversas iniciadas</span><span className={page.statValue}>{count.format(conversationsCount)}</span><span className={page.statHint}>Contato por WhatsApp</span></div>
        <div className={page.stat}><span className={page.statLabel}>Vendas concluídas</span><span className={page.statValue}>{count.format(salesCount)}</span><span className={page.statHint}>Propostas aprovadas</span></div>
        <div className={page.stat}><span className={page.statLabel}>Receita total vendida</span><span className={page.statValue}>{formatCurrency(revenueTotal, { maximumFractionDigits: 0 })}</span><span className={page.statHint}>Taxa de conversão: {conversionRate}%</span></div>
      </div>

      <section className={page.group} aria-labelledby="campaign-ads-title">
        <div className={styles.cardHeadRow}>
          <div className={page.cardHead}>
            <h2 id="campaign-ads-title" className={page.cardTitle}>Anúncios da campanha ({ads.length})</h2>
            <p className={page.cardDescription}>Anúncios ativos e pausados vinculados a esta campanha, com o volume de leads gerados.</p>
          </div>
          <span className={page.badge}>{activeAds} {activeAds === 1 ? "ativo" : "ativos"}</span>
        </div>
        <LiteResponsiveData
          caption="Anúncios da campanha"
          columns={adColumns}
          rows={sortedAds}
          rowKey={(ad) => ad.id}
          empty="Nenhum anúncio individual sincronizado para esta campanha até o momento."
        />
      </section>

      <section className={page.card} aria-labelledby="campaign-forms-title">
        <div className={styles.cardHeadRow}>
          <div className={page.cardHead}>
            <h2 id="campaign-forms-title" className={page.cardTitle}>Formulários da campanha ({forms.length})</h2>
            <p className={page.cardDescription}>Formulários identificados pela atribuição dos leads desta campanha; todos herdam a fila configurada acima.</p>
          </div>
          <span className={page.badge}>Herança da campanha</span>
        </div>
        {forms.length ? (
          <ul className={detail.list}>
            {forms.map((form) => {
              const status = form.status.toUpperCase();
              return (
                <li key={form.id} className={detail.listRow}>
                  <span className={detail.listText}>
                    <span className={page.cellTitle} title={form.name}>{form.name}</span>
                    <span className={page.cellSub}>ID {form.formId}{form.locale ? ` · ${form.locale}` : ""}</span>
                  </span>
                  <span className={page.badge} data-tone={status === "ACTIVE" ? "success" : undefined}>
                    {status === "ACTIVE" ? "Ativo" : status === "UNKNOWN" ? "Status não sincronizado" : "Pausado"}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={page.cardDescription}>Nenhum formulário foi identificado nos anúncios sincronizados ou nos leads atribuídos a esta campanha. Formulários compartilhados seguem a atribuição enviada pela Meta.</p>
        )}
      </section>

      <div className={detail.pair}>
        <section className={page.card} aria-labelledby="campaign-params-title">
          <div className={page.cardHead}>
            <h2 id="campaign-params-title" className={page.cardTitle}>Parâmetros da campanha</h2>
            <p className={page.cardDescription}>Configuração recuperada via Meta Graph API</p>
          </div>
          <dl className={detail.facts}>
            <div><dt>Orçamento diário</dt><dd>{campaign.dailyBudget ? formatCurrency(campaign.dailyBudget / 100) : "Não definido"}</dd></div>
            <div><dt>Orçamento vitalício</dt><dd>{campaign.lifetimeBudget ? formatCurrency(campaign.lifetimeBudget / 100) : "Não definido"}</dd></div>
            <div><dt>Data de início</dt><dd>{formatLiteDate(campaign.startTime, undefined, "Indefinida")}</dd></div>
            <div><dt>Data de término</dt><dd>{formatLiteDate(campaign.stopTime, undefined, "Contínua")}</dd></div>
          </dl>
        </section>

        <section className={page.card} aria-labelledby="campaign-funnel-title">
          <div className={page.cardHead}>
            <h2 id="campaign-funnel-title" className={page.cardTitle}>Funil comercial da campanha</h2>
            <p className={page.cardDescription}>Evolução do lead desde o anúncio até a venda</p>
          </div>
          <ul className={detail.funnel}>
            {funnel.map((step) => (
              <li key={step.stage} className={detail.funnelStep}>
                <span className={detail.funnelLabel}><span>{step.stage}</span><span className={page.numeric}>{count.format(step.count)} ({step.percent})</span></span>
                <span className={detail.funnelTrack} aria-hidden="true"><span className={detail.funnelBar} style={{ width: step.percent }} /></span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

"use client";

/**
 * /marketing/campanhas no visual Lite (Onda 7): os mesmos números, a mesma busca, o mesmo filtro (ativas ou com
 * atendimento) e a mesma ordem, agrupado por conta de anúncios. A linha abre o detalhe; os anúncios da campanha abrem
 * num painel lateral (no lugar da sub-tabela expansível). O controle global e os atalhos vêm por props do servidor.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronRight, Search } from "lucide-react";

import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import page from "@/components/lite/page/lite-page.module.css";
import { formatCurrency } from "@/features/quotes/utils";
import { StatStrip } from "@/features/comercial-lite/comercial-kit";
import type { MetaCampaignItem } from "../../types";
import { campaignDelivery, campaignDetailHref, distributionDestination } from "./meta-lite-shared";
import styles from "./meta-lite.module.css";

export type CampaignsTotals = { leads: number; conversations: number; sales: number; revenue: number; conversionRate: number };

const count = new Intl.NumberFormat("pt-BR");

type CampaignTab = "all" | "running" | "paused" | "noCapture";

/** Aba da campanha (20/11): sem captura primeiro (leads que o CRM ignora); depois veiculando ou pausada na Meta. */
export function campaignTab(campaign: Pick<MetaCampaignItem, "status" | "isEligibleForCapture">): Exclude<CampaignTab, "all"> {
  if (!campaign.isEligibleForCapture) return "noCapture";
  return campaign.status.trim().toUpperCase() === "ACTIVE" ? "running" : "paused";
}

export function CampaignsLite({ campaigns, totals }: { campaigns: MetaCampaignItem[]; totals: CampaignsTotals }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [adsOf, setAdsOf] = useState<MetaCampaignItem | null>(null);
  const [tab, setTab] = useState<CampaignTab>("all");

  const relevant = useMemo(() => campaigns
    .filter((campaign) => campaign.status.trim().toUpperCase() === "ACTIVE" || (campaign.conversationsCount || 0) > 0), [campaigns]);
  const tabCounts = useMemo(() => {
    const next = { all: relevant.length, running: 0, paused: 0, noCapture: 0 };
    for (const campaign of relevant) next[campaignTab(campaign)] += 1;
    return next;
  }, [relevant]);
  const filtered = useMemo(() => relevant
    .filter((campaign) => tab === "all" || campaignTab(campaign) === tab)
    .filter((campaign) => campaign.name.toLowerCase().includes(search.toLowerCase().trim()))
    .sort((a, b) => {
      const aEligible = a.isEligibleForCapture ? 1 : 0;
      const bEligible = b.isEligibleForCapture ? 1 : 0;
      if (bEligible !== aEligible) return bEligible - aEligible;
      return (b.leadsCount || 0) - (a.leadsCount || 0);
    }), [relevant, search, tab]);

  const groups = useMemo(() => {
    const map = new Map<string, { accountId: string; accountName: string; campaigns: MetaCampaignItem[] }>();
    for (const campaign of filtered) {
      const key = campaign.adAccountId || "default";
      const group = map.get(key) ?? { accountId: key, accountName: campaign.adAccountName || `Conta de anúncios ${key}`, campaigns: [] };
      group.campaigns.push(campaign);
      map.set(key, group);
    }
    return [...map.values()];
  }, [filtered]);

  const activeCount = campaigns.filter((campaign) => campaign.status === "ACTIVE" || campaign.status === "active").length;
  // Direção limpa (28/11/2026): quatro números numa faixa só; atendimento e receita viram o detalhe de cada um.
  const stats = [
    { label: "Leads capturados", value: count.format(totals.leads), detail: `${count.format(totals.conversations)} em atendimento` },
    { label: "Vendas", value: count.format(totals.sales), detail: `${formatCurrency(totals.revenue, { maximumFractionDigits: 0 })} em receita` },
    { label: "Conversão", value: `${totals.conversionRate}%`, detail: "de lead para venda" },
    { label: "Campanhas ativas", value: count.format(activeCount), detail: `${count.format(campaigns.length)} no total` },
  ];

  const columns: LiteColumn<MetaCampaignItem>[] = [
    {
      id: "campaign",
      label: "Campanha",
      primary: true,
      render: (campaign) => (
        <span className={styles.campaignCell}>
          <Link href={campaignDetailHref(campaign)} className={styles.campaignName}>{campaign.name}</Link>
          <span className={`${page.cellSub} ${styles.wrapLine}`}>Destino: {distributionDestination(campaign)}</span>
        </span>
      ),
    },
    {
      id: "capture",
      label: "Captura",
      secondary: true,
      render: (campaign) => campaign.isEligibleForCapture
        ? <span className={page.badge} data-tone="success">Captura ativa</span>
        : <span className={page.badge}>Ignorar leads</span>,
    },
    {
      id: "delivery",
      label: "Veiculação Meta",
      render: (campaign) => {
        const delivery = campaignDelivery(campaign.status);
        return <span className={page.badge} data-tone={delivery.tone} title={`Status de veiculação informado pela Meta: ${campaign.status}`}>{delivery.label}</span>;
      },
    },
    { id: "leads", label: "Leads", numeric: true, render: (campaign) => count.format(campaign.leadsCount || 0) },
    { id: "conversations", label: "Atendimento", numeric: true, render: (campaign) => count.format(campaign.conversationsCount || 0) },
    { id: "sales", label: "Vendas", numeric: true, render: (campaign) => count.format(campaign.salesCount || 0) },
    { id: "revenue", label: "Receita", numeric: true, render: (campaign) => formatCurrency(campaign.revenueTotal || 0, { maximumFractionDigits: 0 }) },
    { id: "conversion", label: "Conversão", numeric: true, render: (campaign) => `${campaign.conversionRate || 0}%` },
    {
      id: "actions",
      label: "Ações",
      numeric: true,
      render: (campaign) => {
        const ads = campaign.ads?.length ?? 0;
        return (
          <span className={styles.rowActions}>
            {ads > 0 ? (
              <button type="button" className={styles.adsButton} onClick={() => setAdsOf(campaign)} aria-haspopup="dialog">
                {ads} {ads === 1 ? "anúncio" : "anúncios"}
              </button>
            ) : null}
            <Link href={campaignDetailHref(campaign)} className={page.iconButton} aria-label={`Ver detalhes de ${campaign.name}`} title="Ver detalhes">
              <ChevronRight aria-hidden="true" size={18} />
            </Link>
          </span>
        );
      },
    },
  ];

  return (
    <>
      <StatStrip items={stats} label="Resumo das campanhas" />

      <section className={page.group} aria-labelledby="meta-campaigns-title">
        <div className={styles.sectionHead}>
          <div className={page.cardHead}>
            <h2 id="meta-campaigns-title" className={page.cardTitle}>Campanhas por conta de anúncios</h2>
          </div>
          <label className={page.search}>
            <Search aria-hidden="true" size={18} className={page.searchIcon} />
            <input type="search" className={page.searchInput} placeholder="Buscar campanha" aria-label="Buscar campanha" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
        </div>

        <nav className={page.countTabs} aria-label="Filtrar campanhas">
          {([
            { value: "all", label: "Todas" },
            { value: "running", label: "Veiculando" },
            { value: "paused", label: "Pausadas na Meta" },
            { value: "noCapture", label: "Sem captura" },
          ] as const).map((item) => (
            <button key={item.value} type="button" className={page.countTab} data-active={tab === item.value ? "true" : undefined} aria-pressed={tab === item.value} onClick={() => setTab(item.value)}>
              {item.label}<span className={page.countPill}>{tabCounts[item.value]}</span>
            </button>
          ))}
        </nav>

        {groups.length === 0 ? (
          <div className={page.empty}>
            <h3 className={page.emptyTitle}>Nenhuma campanha encontrada</h3>
            <p className={page.emptyText}>Troque de aba, ajuste o termo pesquisado ou sincronize a Meta.</p>
          </div>
        ) : groups.map((group) => {
          const leads = group.campaigns.reduce((sum, campaign) => sum + (campaign.leadsCount || 0), 0);
          const sales = group.campaigns.reduce((sum, campaign) => sum + (campaign.salesCount || 0), 0);
          return (
            <div key={group.accountId} className={styles.account}>
              <div className={styles.accountHead}>
                <h3 className={styles.accountName}>{group.accountName}</h3>
                <span className={page.cellSub}>
                  ID da conta {group.accountId} · {group.campaigns.length} {group.campaigns.length === 1 ? "campanha" : "campanhas"} · {count.format(leads)} {leads === 1 ? "lead" : "leads"} · {count.format(sales)} {sales === 1 ? "venda" : "vendas"}
                </span>
              </div>
              <LiteResponsiveData
                caption={`Campanhas de ${group.accountName}`}
                columns={columns}
                rows={group.campaigns}
                rowKey={(campaign) => campaign.id}
                onRowOpen={(campaign) => router.push(campaignDetailHref(campaign))}
                empty="Nenhuma campanha"
              />
            </div>
          );
        })}
      </section>

      <LiteSidePanel open={adsOf !== null} onOpenChange={(open) => { if (!open) setAdsOf(null); }} title={adsOf ? `Anúncios de ${adsOf.name}` : "Anúncios"} description="Status de veiculação e leads por anúncio.">
        {adsOf ? (
          <ul className={styles.adList}>
            {(adsOf.ads ?? []).map((ad) => {
              const active = ad.status === "ACTIVE" || ad.status === "active";
              return (
                <li key={ad.id} className={styles.adRow}>
                  <span className={styles.adText}>
                    <span className={page.cellTitle} title={ad.name}>{ad.name}</span>
                    <span className={page.cellSub}>ID {ad.adId}</span>
                  </span>
                  <span className={page.badge} data-tone={active ? "success" : undefined}>{active ? "Ativo" : "Pausado"}</span>
                  <span className={styles.adLeads}>{count.format(ad.leadsCount || 0)} {(ad.leadsCount || 0) === 1 ? "lead" : "leads"}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
        {adsOf ? (
          <Link href={campaignDetailHref(adsOf)} className={page.button} style={{ marginTop: 16 }}>
            Abrir a campanha <ArrowRight aria-hidden="true" size={16} />
          </Link>
        ) : null}
      </LiteSidePanel>
    </>
  );
}

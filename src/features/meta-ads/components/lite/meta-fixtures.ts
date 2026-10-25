/**
 * Dados de exemplo realistas das telas Meta (testes e moldura de desenvolvimento): nomes longos, valores grandes, duas
 * contas de anúncios, campanhas ativas e pausadas, anúncios, formulários e o painel de conversões.
 */
import type { MetaConversionsPanel } from "../../meta-conversion-service";
import type { MetaCampaignItem, MetaConnectionAssets, MetaConnectionInfo, MetaSyncLogItem } from "../../types";
import type { CampaignAdItem, CampaignFormItem } from "../campaign-detail-view";

const CAMPAIGN_NAMES = [
  "[PF] Amil S380 Nacional, leads qualificados zona oeste RJ (outubro)",
  "[PME] Bradesco Saúde Top Flex, empresas de 2 a 29 vidas",
  "Remarketing SulAmérica Exato, visitantes do site 30 dias",
  "[PF] Unimed Rio Pleno, Niterói e São Gonçalo",
  "Institucional Âncora Saúde, alcance Barra da Tijuca",
  "[PME] Clínicas e consultórios, Amil One",
  "Teste criativo vídeo curto, famílias com crianças",
];

export const META_CAMPAIGNS_FIXTURE: MetaCampaignItem[] = CAMPAIGN_NAMES.map((name, index) => ({
  id: `camp-${index + 1}`,
  campaignId: `12021${String(4500000 + index * 7331).padStart(10, "0")}`,
  adAccountId: index < 4 ? "act_118200455" : "act_220981773",
  adAccountName: index < 4 ? "Âncora Saúde, conta principal" : "Âncora Saúde, conta PME e institucional",
  name,
  objective: "LEAD_GENERATION",
  status: index === 4 ? "PAUSED" : index === 6 ? "WITH_ISSUES" : "ACTIVE",
  dailyBudget: 15000 + index * 2500,
  lifetimeBudget: null,
  startTime: new Date(Date.UTC(2026, 8, 1 + index, 12)),
  stopTime: null,
  leadsCount: [1284, 342, 198, 611, 0, 87, 12][index] ?? 0,
  conversationsCount: [903, 211, 120, 402, 3, 54, 4][index] ?? 0,
  salesCount: [61, 18, 9, 27, 0, 4, 0][index] ?? 0,
  revenueTotal: [184320.5, 96210, 21430.9, 77880, 0, 15400, 0][index] ?? 0,
  conversionRate: [4.8, 5.3, 4.5, 4.4, 0, 4.6, 0][index] ?? 0,
  isEligibleForCapture: index !== 4,
  distributionQueueId: index === 1 || index === 5 ? "queue-pme" : null,
  distributionQueueName: index === 1 || index === 5 ? "Fila PME Barra" : null,
  distributionRule: index === 4 ? "none" : index === 2 ? "ad" : "campaign",
  ads: index === 4 ? [] : Array.from({ length: (index % 3) + 2 }, (_, adIndex) => ({
    id: `ad-${index + 1}-${adIndex + 1}`,
    adId: `12021${String(9800000 + index * 100 + adIndex).padStart(10, "0")}`,
    name: `Criativo ${adIndex + 1}: ${["carrossel de hospitais", "vídeo depoimento família", "imagem preço a partir de R$ 289", "story rede credenciada"][adIndex % 4]}`,
    status: adIndex === 2 ? "PAUSED" : "ACTIVE",
    leadsCount: Math.round(([1284, 342, 198, 611, 0, 87, 12][index] ?? 0) / (adIndex + 2)),
  })),
}));

export const META_TOTALS_FIXTURE = { leads: 2534, conversations: 1697, sales: 119, revenue: 395241.4, conversionRate: 4.7 };

export const META_CONNECTION_FIXTURE: MetaConnectionInfo = {
  id: "conn-1",
  tenantId: "tenant-1",
  businessId: "1029384756102938",
  businessName: "Âncora Saúde Corretora de Seguros Ltda",
  status: "connected",
  permissions: ["ads_read", "leads_retrieval", "pages_show_list"],
  expiresAt: null,
  lastError: null,
  lastSyncedAt: new Date("2026-10-25T13:40:00.000Z"),
  pagesCount: 2,
  adAccountsCount: 2,
  whatsappConnected: false,
  globalCaptureMode: "selective",
};

export const META_LOGS_FIXTURE: MetaSyncLogItem[] = [
  { id: "log-1", syncType: "manual", status: "success", itemsSynced: 342, errorDetails: null, durationMs: 18400, startedAt: new Date("2026-10-25T13:39:00.000Z"), completedAt: new Date("2026-10-25T13:40:00.000Z") },
];

export const META_ASSETS_FIXTURE: MetaConnectionAssets = {
  pages: [
    { id: "104857600123", name: "Âncora Saúde", status: "active" },
    { id: "104857600456", name: "Âncora Saúde Empresas e PME", status: "active" },
  ],
  adAccounts: [
    { id: "act_118200455", name: "Âncora Saúde, conta principal", currency: "BRL", status: "active" },
    { id: "act_220981773", name: "Âncora Saúde, conta PME e institucional", currency: "BRL", status: "active" },
  ],
  pixels: [{ id: "889900112233", name: "Pixel site Âncora", status: "active" }],
  datasets: [{ id: "556677889900", name: "Conversões CRM Âncora", status: "active" }],
  leadForms: Array.from({ length: 18 }, (_, index) => ({
    id: `form-${index + 1}`,
    name: `Formulário ${index + 1}: ${index % 2 ? "cotação PME" : "cotação PF"} ${index > 9 ? "(versão antiga)" : ""}`.trim(),
    status: index > 9 ? "archived" : "active",
    pageId: index % 3 ? "104857600123" : "104857600456",
    isEligibleForCapture: index <= 9,
  })),
  campaigns: META_CAMPAIGNS_FIXTURE.map((campaign) => ({ id: campaign.id, name: campaign.name, status: campaign.status, adAccountId: campaign.adAccountId, isEligibleForCapture: campaign.isEligibleForCapture })),
  ads: META_CAMPAIGNS_FIXTURE.flatMap((campaign) => (campaign.ads ?? []).map((ad) => ({ id: ad.id, name: ad.name, status: ad.status, adSetId: `adset-${campaign.id}`, campaignId: campaign.id, isEligibleForCapture: campaign.isEligibleForCapture }))),
};

export const META_CONVERSIONS_FIXTURE: MetaConversionsPanel = {
  available: true,
  enabled: true,
  datasetId: "556677889900",
  testEventCode: null,
  enabledAt: new Date("2026-10-01T12:00:00.000Z"),
  counts: { pending: 14, sent: 2381, failed: 3, skipped: 0 },
  lastError: { message: "Evento recusado pela Meta: parâmetro em_hash ausente para 1 lead sem e-mail.", at: new Date("2026-10-24T18:12:00.000Z") },
};

export const META_DETAIL_ADS_FIXTURE: CampaignAdItem[] = (META_CAMPAIGNS_FIXTURE[0]!.ads ?? []).map((ad) => ({ id: ad.id, adId: ad.adId, name: ad.name, status: ad.status, adSetId: "adset-1", leadsCount: ad.leadsCount ?? 0 }));

export const META_DETAIL_FORMS_FIXTURE: CampaignFormItem[] = [
  { id: "f1", formId: "77001122334455", name: "Cotação PF, Amil S380 (pergunta de vidas e bairro)", status: "ACTIVE", locale: "pt_BR" },
  { id: "f2", formId: "77001122334466", name: "Formulário Meta 77001122334466", status: "UNKNOWN", locale: null },
];

export const META_QUEUES_FIXTURE = [
  { id: "queue-pf", name: "Fila PF Zona Oeste", branchName: "Barra da Tijuca" },
  { id: "queue-pme", name: "Fila PME Barra", branchName: "Barra da Tijuca" },
  { id: "queue-ni", name: "Fila Niterói", branchName: "Niterói 1" },
];

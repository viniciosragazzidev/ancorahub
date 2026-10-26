"use client";

/**
 * Dev-only: telas das Ondas 7 e 8 no visual Lite dentro da moldura real, com dados de exemplo realistas. Cada tela usa
 * os mesmos componentes Lite da página real (o servidor calcula o resumo da sincronização; aqui ele vem pronto).
 */
import { DashboardHeader } from "@/components/dashboard-header";
import { LiteRelatedLinks } from "@/components/lite/page/related-links";
import litePage from "@/components/lite/page/lite-page.module.css";
import { CampaignsLite } from "@/features/meta-ads/components/lite/campaigns-lite";
import { CampaignDetailLite } from "@/features/meta-ads/components/lite/campaign-detail-lite";
import { CaptureControlLite } from "@/features/meta-ads/components/lite/capture-control-lite";
import { MetaConversionsLite } from "@/features/meta-ads/components/lite/meta-conversions-lite";
import { MetaIntegrationLite } from "@/features/meta-ads/components/lite/meta-integration-lite";
import { MetaStatusLite } from "@/features/meta-ads/components/lite/meta-status-lite";
import type { MetaSyncInfo } from "@/features/meta-ads/components/lite/meta-lite-shared";
import { META_ASSETS_FIXTURE, META_CAMPAIGNS_FIXTURE, META_CONNECTION_FIXTURE, META_CONVERSIONS_FIXTURE, META_DETAIL_ADS_FIXTURE, META_DETAIL_FORMS_FIXTURE, META_QUEUES_FIXTURE, META_TOTALS_FIXTURE } from "@/features/meta-ads/components/lite/meta-fixtures";
import { MarketingImportLite } from "@/app/(dashboard)/marketing/importacoes/_components/marketing-import-lite";
import { PaymentProofValidatorLite, type ValidatorLiteResult } from "@/features/payment-proof-validator/components/payment-proof-validator-lite";
import { SubscriptionLite } from "@/app/(dashboard)/assinatura/_components/subscription-lite";
import { SystemGuideLite } from "@/features/guide/components/system-guide-lite";
import { WebhookTutorialLite } from "@/app/(dashboard)/guia/webhook/webhook-tutorial-lite";
import { WelcomeScreenLite } from "@/features/onboarding/components/welcome-screen-lite";
import type { TenantOnboarding } from "@/features/onboarding/types/onboarding.types";
import { MaterialsWorkspace } from "@/features/operator-catalog/components/materials-workspace";
import type { CarrierOverview, MaterialRow } from "@/features/operator-catalog/queries";
import type { AreaInfo } from "@/features/operator-catalog/components/labels";
import { LiteUrlSelect } from "@/components/lite/controls";
import { UnitOverviewView } from "@/features/team-management-ui/unit-overview";
import { TeamPageViewComponent } from "@/features/team-management-ui/team-page-view";
import { gestaoOverviewFixture, gestaoTeamFixture } from "./gestao-fixtures";

const SYNC: MetaSyncInfo = { tone: "success", label: "Concluída", detail: "há 1 h · 342 itens", title: "Última sincronização: 25/10/2026, 10:40", errorDetails: null };

export function CampanhasShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Marketing" title="Campanhas Meta Ads e ROI" />
      <main className={litePage.stack}>
        <MetaStatusLite connected sync={SYNC} captureModeLabel="Captura seletiva" />
        <CampaignsLite campaigns={META_CAMPAIGNS_FIXTURE} totals={META_TOTALS_FIXTURE} />
        <CaptureControlLite globalMode="selective" canConfigure />
        <LiteRelatedLinks
          title="Ferramentas e integrações de marketing"
          description="Navegação contextual para captação de leads e anúncios."
          links={[
            { label: "Importações de leads Meta", href: "/marketing/importacoes", description: "Logs de entrada e formulários" },
            { label: "Materiais de divulgação", href: "/materiais-divulgacao", description: "Banners, e-books e artes de apoio" },
            { label: "Configurar webhooks Meta Lead Ads", href: "/settings?tab=integrations", description: "Token de acesso e formulários" },
            { label: "Regras de qualificação IA", href: "/qualificacao", description: "Como a IA atende os novos leads" },
          ]}
        />
      </main>
    </>
  );
}

export function CampanhaShellScreen() {
  const campaign = META_CAMPAIGNS_FIXTURE[0]!;
  return (
    <>
      <DashboardHeader breadcrumb="Marketing / Campanhas" title={campaign.name} />
      <main className={litePage.stack}>
        <CampaignDetailLite campaign={campaign} ads={META_DETAIL_ADS_FIXTURE} forms={META_DETAIL_FORMS_FIXTURE} queues={META_QUEUES_FIXTURE} initialQueueId="queue-pf" initialCaptureEnabled canConfigureCapture canDisableCapture />
      </main>
    </>
  );
}

const IMPORT_HISTORY = Array.from({ length: 9 }, (_, index) => ({
  id: `imp-${index + 1}`,
  fileName: index === 0 ? "leads-meta-outubro-semana-4-barra-da-tijuca-e-niteroi-versao-final.xlsx" : `leads-meta-${["pf", "pme", "remarketing"][index % 3]}-${String(24 - index).padStart(2, "0")}-10.csv`,
  status: index === 3 ? "failed" : index === 5 ? "processing" : "completed",
  totalRows: 420 - index * 31,
  importedCount: index === 3 ? 0 : 398 - index * 30,
  duplicateCount: 17 - index,
  invalidCount: index % 4,
  durationMs: 8400,
  errorMessage: index === 3 ? "Formato inválido" : null,
  createdAt: new Date(Date.UTC(2026, 9, 24 - index, 21, 15)),
  userName: index % 2 ? "Bruno Lima" : "Marina Exemplo",
}));

export function ImportacoesShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Marketing / Importações" title="Importar leads Meta" />
      <main className={litePage.stack}>
        <MarketingImportLite branches={[{ id: "b1", name: "Barra da Tijuca" }, { id: "b2", name: "Niterói 1" }]} history={IMPORT_HISTORY} lastImport={IMPORT_HISTORY[0]!} canChooseBranch userBranchId={null} />
      </main>
    </>
  );
}

export function MetaShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Integrações" title="Marketing Meta" />
      <main className={litePage.stack}>
        <MetaIntegrationLite connection={META_CONNECTION_FIXTURE} assets={META_ASSETS_FIXTURE} sync={SYNC} captureModeLabel="Captura seletiva" canConfigure />
        <MetaConversionsLite panel={META_CONVERSIONS_FIXTURE} datasets={[{ id: "556677889900", name: "Conversões CRM Âncora" }]} />
      </main>
    </>
  );
}

// Onda 8 (diretor com a chave)

const PROOF_RESULT: ValidatorLiteResult = {
  validation: {
    verdict: "revisar",
    checks: [
      { id: "valor", label: "Valor pago igual ao total da proposta", status: "ok", detail: "R$ 1.284,90 no comprovante e na proposta." },
      { id: "beneficiario", label: "Beneficiário é a operadora", status: "ok", detail: "Amil Assistência Médica Internacional S.A." },
      { id: "linha", label: "Linha digitável igual à do boleto", status: "warn", detail: "Boleto original não enviado: confira a linha digitável no portal da operadora." },
      { id: "pagador", label: "Pagador é o titular ou a empresa", status: "fail", detail: "O pagador (Bartolomeu Wanderley Castelo Branco) não é o titular da proposta." },
      { id: "data", label: "Pagamento antes do vencimento", status: "skip", detail: "Data de vencimento não encontrada na proposta." },
    ],
  },
  proposal: { operadora: "Amil", numeroProposta: "PRP-2026-0098812", valorTotal: 1284.9, titular: { nome: "Cristiane Farizele Monteiro" }, empresa: null, emailContato: "cristiane.monteiro@example.test", corretor: { nome: "Ana Souza" } } as unknown as ValidatorLiteResult["proposal"],
  proof: { instituicao: "Banco Inter", status: "Pago", valor: 1284.9, beneficiarioNome: "Amil Assistência Médica", beneficiarioDocumento: "29.309.127/0001-79", pagadorNome: "Bartolomeu Wanderley Castelo Branco", pagadorDocumento: "***.456.789-**", linhaDigitavel: "23793.38128 60082.098812 34000.050009 1 98760000128490" } as unknown as ValidatorLiteResult["proof"],
  boleto: null,
};

export function ValidadorShellScreen({ withResult }: { withResult: boolean }) {
  return (
    <>
      <DashboardHeader breadcrumb="Ferramentas" title="Validador de comprovante" />
      <main className={litePage.stack}>
        <PaymentProofValidatorLite initialResult={withResult ? PROOF_RESULT : null} />
      </main>
    </>
  );
}

export function AssinaturaShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Administração" title="Assinatura" />
      <main className={litePage.stack}>
        <SubscriptionLite
          tenant={{ name: "Âncora Saúde", legalName: "Âncora Saúde Corretora de Seguros Ltda", cnpj: "12.345.678/0001-90", status: "active", createdAt: new Date("2025-07-24T13:00:00.000Z") }}
          plan={{ label: "Profissional", features: ["Até 10 usuários", "Gestão de leads e vendas", "Catálogo de planos", "Relatórios avançados", "Integração com WhatsApp", "Metas comerciais"] }}
          usage={[
            { label: "Usuários ativos", value: 87, limit: 99 },
            { label: "Filiais ativas", value: 3, limit: 99 },
            { label: "Leads registrados", value: 48213, limit: null },
            { label: "Clientes convertidos", value: 2391, limit: null },
          ]}
        />
      </main>
    </>
  );
}

export function GuiaShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Administração" title="Guia do sistema" />
      <main className={litePage.stack}>
        <SystemGuideLite role="director" />
      </main>
    </>
  );
}

export function WebhookShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Guia do sistema" title="Integração via webhook" />
      <main className={litePage.stack}>
        <WebhookTutorialLite />
      </main>
    </>
  );
}

const WELCOME_ONBOARDING: TenantOnboarding = {
  tenantName: "Âncora Saúde",
  userName: "Marina Exemplo",
  dismissed: false,
  shouldAutoOpen: true,
  steps: [
    { id: "branches" as never, title: "Cadastrar unidades", description: "Crie as unidades da corretora.", status: "completed", href: "/equipe?visao=unidades", actionLabel: "Abrir", essential: true },
    { id: "team" as never, title: "Convidar a equipe", description: "Convide gestores, supervisores e corretores para entrar no CRM.", status: "pending", href: "/equipe/convidar", actionLabel: "Convidar", essential: true },
    { id: "queues" as never, title: "Configurar filas de distribuição", description: "Defina para onde vão os leads de cada origem.", status: "pending", href: "/distribuicao", actionLabel: "Configurar", essential: true },
    { id: "whatsapp" as never, title: "Conectar o WhatsApp", description: "Disponível depois de convidar a equipe.", status: "unavailable", href: null, actionLabel: null, essential: false },
  ],
  totalSteps: 4,
  availableSteps: 3,
  completedSteps: 1,
  progressPercentage: 33,
  essentialCompleted: false,
  fullyCompleted: false,
};

export function BoasVindasShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Início" title="Boas-vindas" />
      <main className={litePage.stack}>
        <WelcomeScreenLite userName="Marina Exemplo" role="director" tenantName="Âncora Saúde" onboarding={WELCOME_ONBOARDING} greeting="Boa tarde" />
      </main>
    </>
  );
}

const MATERIALS = Array.from({ length: 14 }, (_, index) => ({
  id: `mat-${index + 1}`,
  fileName: `${["tabela-amil-pme-outubro-2026", "manual-bradesco-top-flex", "rede-sulamerica-rj-hospitais", "promocao-unimed-rio-novembro"][index % 4]}-${index + 1}.pdf`,
  fileType: "application/pdf",
  createdAt: new Date(Date.UTC(2026, 9, 24 - index, 15)).toISOString(),
  status: ["cataloged", "needs_review", "processing", "cataloged", "failed"][index % 5] ?? "cataloged",
  documentType: "price_table",
  carrierId: `car-${(index % 4) + 1}`,
  carrierName: ["Amil", "Bradesco Saúde", "SulAmérica", "Unimed Rio"][index % 4] ?? null,
  origin: index % 3 ? "upload" : "whatsapp",
  hasOriginal: true,
  summary: { title: ["Tabela Amil PME outubro 2026", "Manual Bradesco Top Flex", "Rede SulAmérica RJ", "Promoção Unimed Rio novembro"][index % 4], facts: 120 - index * 7, added: 12, updated: 4 },
})) as unknown as MaterialRow[];

const AREAS: AreaInfo[] = [
  { slug: "precos", label: "Preços", description: "Valores por faixa etária e acomodação.", fields: [{ key: "valor", label: "Valor" }], custom: false, reviewRequired: true },
  { slug: "rede", label: "Rede credenciada", description: "Hospitais, laboratórios e clínicas.", fields: [{ key: "hospital", label: "Hospital" }], custom: false, reviewRequired: false },
  { slug: "carencias", label: "Carências", description: "Prazos por procedimento.", fields: [{ key: "prazo", label: "Prazo" }], custom: false, reviewRequired: true },
];

const CARRIERS: CarrierOverview[] = ["Amil", "Bradesco Saúde", "SulAmérica", "Unimed Rio"].map((name, index) => ({ id: `car-${index + 1}`, name, activePlans: 12 - index * 2, draftPlans: index, facts: 840 - index * 120, areas: [{ slug: "precos", facts: 400 }, { slug: "rede", facts: 300 }, { slug: "carencias", facts: 140 }], updatedAt: new Date(Date.UTC(2026, 9, 24 - index, 15)).toISOString() }));

export function MateriaisShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Ferramentas" title="Materiais das operadoras" />
      <main className={litePage.stack}>
        <MaterialsWorkspace
          materials={MATERIALS}
          queue={{ draftPlans: [], pendingFacts: [], missingFacts: [], suggestions: [], divergences: [] }}
          carriers={CARRIERS}
          areas={AREAS}
          carrierOptions={CARRIERS.map((carrier) => ({ id: carrier.id, name: carrier.name }))}
          semanticSearch
        />
      </main>
    </>
  );
}

// /gestao do diretor (unidade escolhida no seletor) e a equipe aberta a partir dela.
export function GestaoShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Gestão de equipe" title="Gestão da unidade" />
      <main className={litePage.stack}>
        <div className={litePage.toolbar}>
          <LiteUrlSelect className={litePage.select} label="Unidade" param="unidade" value="branch-centro" defaultValue="branch-centro" options={[{ value: "branch-centro", label: "Centro" }, { value: "branch-barra", label: "Barra da Tijuca" }, { value: "branch-ni", label: "Niterói 1" }]} />
        </div>
        <UnitOverviewView overview={gestaoOverviewFixture()} embedded />
      </main>
    </>
  );
}

export function GestaoEquipeShellScreen() {
  const view = gestaoTeamFixture();
  return (
    <>
      <DashboardHeader breadcrumb="Gestão de equipe" title={view.teamName} />
      <main className={litePage.stack}>
        <TeamPageViewComponent view={view} embedded />
      </main>
    </>
  );
}

import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DirectorLiteDashboard } from "@/features/dashboard/components/director-lite/director-lite-dashboard";
import { buildEssential } from "@/app/dev/diretor-dashboard-preview/_components/essential-example";
import type { UserDisplayInfo } from "@/shared/auth/actions";
import { DashboardHeader } from "@/components/dashboard-header";
import liteStyles from "@/app/(dashboard)/leads/leads-lite-page.module.css";
import { LeadDetailFixture } from "@/app/dev/diretor-lead-real/lead-detail-fixture";
import { ConversationsFrame } from "@/app/(dashboard)/conversas/conversations-frame";
import type { ConversationItem } from "@/app/(dashboard)/conversas/conversations-workspace";
import { LightConversationsView, type BrokerConversationInsight } from "@/features/broker-workspace/components/light-conversations-view";

import { DirectorLiteChrome } from "@/features/dashboard/components/director-lite/director-lite-chrome";
import { DirectorLiteQualificationFunnelPage } from "@/features/dashboard/components/director-lite/qualification-funnel-page";
import { QualityToolbar, QualityView } from "@/features/dashboard/components/director-lite/quality-view";

import { CASE_NOW, DASHBOARD_CASES, essentialCase, funnelCase, qualityCase, type DashboardCase } from "./dashboard-cases";
import { LeadsShellScreen } from "./leads-screen";
import { ONDA3_SCREENS } from "./onda3-registry";
import { ONDA6_SCREENS } from "./onda6-registry";
import { ONDA5_SCREENS } from "./onda5-screens";
import { ONDA10_SCREENS } from "./onda10-registry";
import { EquipeShellScreen } from "./onda4-screens";
import { VendasShellScreen } from "./onda3-screens";
import { SettingsShellScreen } from "./onda6-settings-screens";
import AccessDeniedPage from "@/app/(auth)/access-denied/page";

const permissions = [
  "acessar_dashboard",
  "acessar_conversas",
  "acessar_leads",
  "acessar_qualificacao_ia",
  "acessar_vendas",
  "convidar_corretor",
  "acessar_configuracoes_pessoais",
  "acessar_campanhas_meta",
  "acessar_ferramentas",
];

/**
 * ?papel=marketing|personalizado: o mesmo shell Lite para papéis do modo normal que não são diretor (decisão de 25/10).
 * Permissões de exemplo: marketing (manager com cargo marketing, sem unidade) e um cargo personalizado de gestor
 * com unidade e permissões parciais. Telas que o papel não abre mostram o acesso negado, como o app real.
 */
const PAPEIS = {
  marketing: {
    label: "Marketing",
    roleKey: "manager" as const,
    jobTitle: "marketing",
    branchId: null,
    permissions: ["acessar_dashboard", "acessar_leads", "acessar_campanhas_meta", "acessar_configuracoes_pessoais"],
    denied: ["/conversas", "/vendas", "/equipe"],
    tabs: ["overview"] as const,
    canOpenConversations: false,
    settings: "marketing" as const,
  },
  personalizado: {
    label: "Analista comercial",
    roleKey: "manager" as const,
    jobTitle: "manager",
    branchId: "branch-centro",
    permissions: ["acessar_dashboard", "acessar_leads", "acessar_conversas", "acessar_vendas", "acessar_configuracoes_pessoais"],
    denied: [] as string[],
    tabs: ["overview", "quality", "funnel"] as const,
    canOpenConversations: true,
    settings: "manager" as const,
  },
};

const demoNow = new Date("2026-10-24T16:42:00.000Z");
const demoBranches = [
  { id: "branch-centro", name: "Centro" },
  { id: "branch-norte", name: "Zona Norte" },
];
const conversationFixtures: ConversationItem[] = [
  {
    id: "lead-fixture-ana",
    nome: "Ana Ribeiro",
    telefone: "+55 11 99999-0101",
    email: "ana.ribeiro@example.test",
    status: "qualified",
    qualificationStatus: "qualified",
    origem: "Meta Ads",
    branchId: "branch-centro",
    queueName: "PF",
    corretorId: "fixture-director",
    corretorNome: "Marina Exemplo",
    branchName: "Centro",
    consentimentoLgpd: true,
    createdAt: "2026-10-24T12:10:00.000Z",
    stageEnteredAt: "2026-10-24T14:20:00.000Z",
    planName: "Essencial Regional",
    carrierName: "Saúde Exemplo",
    privateNotes: "Prefere contato depois do almoço.",
    latestMessage: { body: "Podemos conversar sobre a rede de hospitais que atendem na região de Pinheiros? Também queria entender se existe coparticipação nas consultas e exames.", direction: "incoming", sentAt: "2026-10-24T15:34:00.000Z" },
    messages: [
      { id: "msg-fixture-ana-1", leadId: "lead-fixture-ana", body: "Olá, gostaria de entender as opções para contratar um plano de saúde individual para mim e para minha filha. A prioridade é ter uma boa rede na zona oeste de São Paulo.", direction: "incoming", sentAt: "2026-10-24T15:28:00.000Z" },
      { id: "msg-fixture-ana-2", leadId: "lead-fixture-ana", body: "Claro, posso te ajudar com isso. Você busca cobertura em qual região e tem preferência por algum hospital ou laboratório que gostaria de manter na rede?", direction: "outgoing", sentAt: "2026-10-24T15:31:00.000Z" },
      { id: "msg-fixture-ana-3", leadId: "lead-fixture-ana", body: "Podemos conversar sobre a rede de hospitais que atendem na região de Pinheiros? Também queria entender se existe coparticipação nas consultas e exames.", direction: "incoming", sentAt: "2026-10-24T15:34:00.000Z" },
    ],
    documents: [],
    aiConversation: { id: "ai-fixture-ana", status: "HUMAN_ACTIVE", aiModel: null, transferReason: "Solicitou atendimento", qualificationSummary: "Busca plano individual", assignedUserId: "fixture-director" },
    tags: [],
  },
  {
    id: "lead-fixture-bruno",
    nome: "Bruno Martins de Almeida Nogueira",
    telefone: "+55 11 99999-0102",
    email: null,
    status: "distributed",
    origem: "Indicação",
    branchId: "branch-norte",
    queueName: "PME",
    corretorId: "fixture-broker-2",
    corretorNome: "João Exemplo",
    branchName: "Zona Norte",
    consentimentoLgpd: true,
    createdAt: "2026-10-24T10:05:00.000Z",
    stageEnteredAt: "2026-10-24T11:15:00.000Z",
    planName: null,
    carrierName: null,
    latestMessage: { body: "Obrigado, fico no aguardo.", direction: "incoming", sentAt: "2026-10-24T11:18:00.000Z" },
    messages: [{ id: "msg-fixture-bruno-1", leadId: "lead-fixture-bruno", body: "Obrigado, fico no aguardo.", direction: "incoming", sentAt: "2026-10-24T11:18:00.000Z" }],
    documents: [],
  },
  {
    id: "lead-fixture-carla",
    nome: "Carla Souza Menezes Ferraz",
    telefone: "+55 11 99999-0103",
    email: "carla.souza@example.test",
    status: "new",
    origem: "Site",
    branchId: "branch-centro",
    queueName: "PF",
    corretorId: null,
    corretorNome: null,
    branchName: "Centro",
    consentimentoLgpd: false,
    createdAt: "2026-10-23T19:05:00.000Z",
    stageEnteredAt: "2026-10-24T09:40:00.000Z",
    planName: null,
    carrierName: null,
    latestMessage: null,
    messages: [],
    documents: [],
  },
];
const fixtureFirstNames = ["Beatriz", "Camila", "Daniela", "Eduarda", "Fernanda", "Giovana", "Helena", "Isabela", "Juliana", "Larissa", "Mariana", "Natália", "Patrícia"];
const fixtureFamilyNames = ["de Almeida Carvalho", "Pereira dos Santos", "Fernandes Monteiro", "Lima Vasconcelos", "Rodrigues de Oliveira", "Costa Nascimento", "Mendes Albuquerque", "Ribeiro de Moraes", "Barbosa Figueiredo", "Martins Siqueira"];
const additionalConversationFixtures: ConversationItem[] = Array.from({ length: 37 }, (_, index) => {
  const sequence = index + 4;
  const id = `lead-fixture-${sequence}`;
  const sentAt = new Date(demoNow.getTime() - (index * 7 + 2) * 60_000).toISOString();
  const body = "Olá, estou comparando opções para a minha família e queria receber detalhes sobre a rede credenciada, os prazos de carência e o valor mensal para a região onde moramos. Pode me explicar com calma quais são as diferenças entre as alternativas?";
  const messageCount = 2 + (index % 4);
  const messages = Array.from({ length: messageCount }, (_, messageIndex) => ({
    id: `msg-fixture-${sequence}-${messageIndex + 1}`,
    leadId: id,
    body: messageIndex === messageCount - 1 ? body : `Obrigado pelo retorno. Quero conferir os detalhes da proposta ${messageIndex + 1} antes de decidir com a minha família.`,
    direction: messageIndex % 2 === 0 ? "incoming" : "outgoing",
    sentAt: new Date(new Date(sentAt).getTime() - (messageCount - messageIndex - 1) * 2 * 60_000).toISOString(),
  }));
  const isQualified = index % 3 === 0;
  return {
    id,
    nome: `${fixtureFirstNames[index % fixtureFirstNames.length]} ${fixtureFamilyNames[index % fixtureFamilyNames.length]}`,
    telefone: `+55 11 98888-${String(1000 + sequence).slice(-4)}`,
    email: `contato-${sequence}@example.test`,
    status: isQualified ? "qualified" : index % 2 === 0 ? "distributed" : "in_contact",
    qualificationStatus: isQualified ? "qualified" : null,
    origem: index % 2 === 0 ? "Meta Ads" : "Indicação",
    branchId: index % 2 === 0 ? "branch-centro" : "branch-norte",
    queueName: index % 2 === 0 ? "PF" : "PME",
    corretorId: `fixture-broker-${sequence}`,
    corretorNome: `Corretor ${sequence}`,
    branchName: index % 2 === 0 ? "Centro" : "Zona Norte",
    consentimentoLgpd: true,
    createdAt: sentAt,
    stageEnteredAt: sentAt,
    planName: index % 2 === 0 ? "Essencial Regional" : null,
    carrierName: index % 2 === 0 ? "Saúde Exemplo" : null,
    latestMessage: { body, direction: "incoming", sentAt },
    messages,
    documents: [],
    aiConversation: index % 2 === 0 ? { id: `ai-fixture-${sequence}`, status: "HUMAN_ACTIVE", aiModel: null, transferReason: "Solicitou atendimento", qualificationSummary: "Busca opções para a família", assignedUserId: "fixture-director" } : undefined,
    tags: [],
  };
});
conversationFixtures.push(...additionalConversationFixtures);

const brokerConversationFixtures: BrokerConversationInsight[] = conversationFixtures.map((conversation) => {
  const mapMessage = ({ id, body, direction, sentAt, providerStatus }: ConversationItem["messages"][number]) => ({ id, body, direction, sentAt, providerStatus });
  const latestMessage = conversation.messages.at(-1);
  return {
    id: conversation.id,
    kind: "lead",
    name: conversation.nome,
    phone: conversation.telefone,
    status: conversation.status,
    href: `/leads/${conversation.id}`,
    latestMessage: latestMessage ? mapMessage(latestMessage) : null,
    messages: conversation.messages.map(mapMessage),
    intelligence: {
      summary: "A pessoa busca cobertura para a família e pediu informações sobre a rede de atendimento e os valores.",
      nextBestAction: "Responder pelo WhatsApp com opções da região e confirmar a faixa de investimento.",
      pendingFrom: "BROKER",
      sentiment: "POSITIVE",
      customerIntent: "HIGH",
    },
  };
});

export default async function DirectorShellRealPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const isSuperAdminViewingDirector = params.case === "super-admin";
  const isBrokerConversationPreview = params.view === "conversas" && params.papel === "corretor";
  const papel = params.papel === "marketing" || params.papel === "personalizado" ? PAPEIS[params.papel] : null;
  const showConversations = params.view === "conversas";
  // ?tela=dashboard (padrão), leads, kanban, qualificacao, sem-atribuicao, radar ou lead: a mesma moldura real com cada tela.
  const screen = typeof params.tela === "string" ? params.tela : "dashboard";
  const leadsViews: Record<string, "list" | "kanban" | "qualificacoes" | "sem-atribuicao" | "radar"> = { leads: "list", kanban: "kanban", qualificacao: "qualificacoes", "sem-atribuicao": "sem-atribuicao", radar: "radar" };
  const leadsView = leadsViews[screen];
  const onda3 = ONDA3_SCREENS[screen] ?? ONDA6_SCREENS[screen] ?? ONDA10_SCREENS[screen];
  const onda5 = ONDA5_SCREENS[screen];
  const pathname = showConversations ? "/conversas" : onda5 ? onda5.path : onda3 ? onda3.path : leadsView ? "/leads" : screen === "lead" ? "/leads/11111111-1111-4111-8111-111111111111" : "/dashboard";
  const name = isSuperAdminViewingDirector ? "Alex Exemplo" : papel ? "Rafaela Exemplo" : "Marina Exemplo";
  // Painel: ?aba=operacao|qualidade|funil e ?caso=uma-hora|zerado|cheio|uma-fila (casos de borda com dados de exemplo).
  const tab = params.aba === "qualidade" ? "qualidade" : params.aba === "funil" ? "funil" : "operacao";
  const dashboardCase = DASHBOARD_CASES.find((item) => item === params.caso) as DashboardCase | undefined;
  const firstName = name.split(" ")[0] ?? name;
  const caseNow = dashboardCase ? CASE_NOW[dashboardCase] : demoNow;
  const dashboard = tab === "qualidade" ? (
    <DirectorLiteChrome now={caseNow} tab="quality" period="today" branchId={null} branches={demoBranches} firstName={firstName}>
      <QualityToolbar legacyHref="/dashboard?tab=quality&period=today&legado=1" detailedHref="/dashboard?tab=quality&period=today&vista=detalhada&legado=1" />
      <QualityView report={qualityCase(dashboardCase ?? "cheio")} unitName={null} now={caseNow} widerHref="/dashboard?tab=quality&periodo=7" />
    </DirectorLiteChrome>
  ) : tab === "funil" ? (
    <DirectorLiteQualificationFunnelPage data={funnelCase(dashboardCase ?? "cheio")} branchId={null} branches={demoBranches} firstName={firstName} now={caseNow} />
  ) : (
    <DirectorLiteDashboard
      data={{ ...(dashboardCase ? essentialCase(dashboardCase) : buildEssential("today", "all", demoNow)), firstName }}
      period="today"
      branchId={null}
      branches={papel ? [] : demoBranches}
      now={caseNow}
      availableTabs={papel?.tabs}
      canOpenConversations={papel?.canOpenConversations}
    />
  );
  const previewUser: UserDisplayInfo = {
    name,
    role: isBrokerConversationPreview ? "Corretor" : papel?.label ?? "Diretor",
    roleKey: isBrokerConversationPreview ? "broker" : papel?.roleKey ?? "director",
    jobTitle: isBrokerConversationPreview ? "broker" : papel?.jobTitle ?? "director",
    permissions: isBrokerConversationPreview ? ["acessar_conversas", "acessar_dashboard", "acessar_leads"] : papel?.permissions ?? permissions,
    redirectLogout: "/dashboard",
    isPlatformAdmin: isSuperAdminViewingDirector,
    activeRoleOverride: isSuperAdminViewingDirector ? "director" : null,
    userProfileEnabled: true,
    relationshipCenterEnabled: true,
  };

  if (papel && papel.denied.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return <AccessDeniedPage />;
  // Com ?papel=, as telas com regra por papel recebem o papel visto (as demais seguem a fixture de hoje).
  const papelScreen = !papel ? null
    : screen === "vendas" ? <VendasShellScreen role={papel.roleKey} />
    : screen === "equipe" ? <EquipeShellScreen role="manager" branchId={papel.branchId} />
    : screen === "configuracoes" ? <SettingsShellScreen variant={papel.settings} />
    : leadsView ? <LeadsShellScreen view={leadsView} role={papel.roleKey} jobTitle={papel.jobTitle} branchId={papel.branchId} />
    : null;

  return (
    <AppShell
      isLightBroker={isBrokerConversationPreview}
      initialChatRail={isBrokerConversationPreview ? { viewerName: name, assistants: [], leads: [], nowIso: demoNow.toISOString(), canQuote: false } : null}
      directorLiteEnabled={!isBrokerConversationPreview}
      initialSidebarUser={previewUser}
      initialSidebarPathname={pathname}
      initialSidebarOnDuty={isSuperAdminViewingDirector}
      user={{ name, email: "fixture@ancora.example", role: papel?.label ?? "Diretor", jobTitle: papel?.jobTitle ?? "director", isPlatformAdmin: isSuperAdminViewingDirector }}
      branding={{ brandColor: null, logoUrl: null, tenantName: "\u00c2ncora Sa\u00fade" }}
      viewAs={{ canViewAs: isSuperAdminViewingDirector, viewingAs: null }}
    >
      {papelScreen ?? (showConversations ? (
        isBrokerConversationPreview ? (
          <LightConversationsView
            insights={brokerConversationFixtures}
            initialLeadId="lead-fixture-ana"
            whatsappConnected
            connectionStatus="ready"
          />
        ) : <ConversationsFrame
          role={papel?.roleKey ?? "director"}
          branches={papel ? [] : demoBranches}
          conversations={conversationFixtures}
          initialLeadId="lead-fixture-ana"
          userId="fixture-director"
          tenantId="fixture-tenant"
          leadTags={[]}
          canManageTags
          officialBrokerEnabled={false}
          officialBrokerDeliveryChannel="meta"
          officialBrokerConversations={[]}
          canSeeBrokerTab
          currentTab="leads"
          leadsCount={conversationFixtures.length}
          officialBrokerTab={false}
        />
      ) : onda5 ? onda5.render({ role: previewUser.roleKey ?? "director", jobTitle: previewUser.jobTitle, branchId: null }) : onda3 ? onda3.render() : leadsView ? (
        <LeadsShellScreen view={leadsView} />
      ) : screen === "lead" ? (
        <>
          <DashboardHeader breadcrumb="Operação comercial" title="Perfil do lead" />
          <main className={liteStyles.page}>
            <LeadDetailFixture />
          </main>
        </>
      ) : dashboard)}
    </AppShell>
  );
}

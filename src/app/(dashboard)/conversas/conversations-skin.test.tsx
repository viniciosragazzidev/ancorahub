import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/conversas" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/dashboard-header", () => ({
  DashboardHeader: ({ breadcrumb, title, rightSlot }: { breadcrumb: string; title: string; rightSlot?: import("react").ReactNode }) => (
    <header data-slot="dashboard-header">{breadcrumb} {title}{rightSlot}</header>
  ),
}));

import { ArcScopeProvider } from "@/components/arc/arc-scope-context";
import { SidebarProvider } from "@/components/ui/sidebar";
import { isDirectorLiteRouteOptedOut } from "@/components/arc/director-lite-routes";
import { ConversationsFrame } from "./conversations-frame";
import { ConversationsWorkspace, type ConversationItem } from "./conversations-workspace";
import { OfficialBrokerConversations } from "./official-broker-conversations";
import { ConversasHeaderNav } from "./_components/conversas-header-nav";
import styles from "./conversas-lite.module.css";

function renderWorkspace(enabled: boolean, pathname = "/conversas") {
  navigation.pathname = pathname;
  return renderToStaticMarkup(
    <SidebarProvider>
      <ArcScopeProvider enabled={enabled && !isDirectorLiteRouteOptedOut(pathname)}>
        <ConversationsFrame
          role="director"
          branches={[]}
          conversations={[]}
          userId="fixture-director"
          tenantId="fixture-tenant"
          leadTags={[]}
          canManageTags={false}
          officialBrokerEnabled={false}
          officialBrokerDeliveryChannel="meta"
          officialBrokerConversations={[]}
          canSeeBrokerTab
          currentTab="leads"
          leadsCount={0}
          officialBrokerTab={false}
        />
      </ArcScopeProvider>
    </SidebarProvider>,
  );
}

function renderLegacyWorkspaceSnapshot() {
  navigation.pathname = "/conversas";
  return renderToStaticMarkup(
    <ArcScopeProvider enabled={false}>
      <div className={`arc-venancor ${styles.root} flex h-app min-h-0 w-full flex-1 flex-col overflow-hidden`}>
        <header data-slot="dashboard-header">Conversas</header>
        <main className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background p-0">
          <div data-lite="frame" className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-card">
            <ConversationsWorkspace
              role="director"
              branches={[]}
              conversations={[]}
              userId="fixture-director"
              tenantId="fixture-tenant"
            />
          </div>
        </main>
      </div>
    </ArcScopeProvider>,
  );
}

function renderSelectedConversation(corretorNome: string | null = "Marina Exemplo") {
  navigation.pathname = "/dev/diretor-shell-real";
  const conversation: ConversationItem = {
    id: "lead-fixture-ana",
    nome: "Ana Ribeiro de Almeida Nogueira",
    telefone: "+55 11 99999-0101",
    email: "ana@example.test",
    status: "qualified",
    qualificationStatus: "qualified",
    origem: "Meta Ads",
    branchId: "branch-centro",
    queueName: "PF",
    corretorId: corretorNome ? "fixture-director" : null,
    corretorNome,
    branchName: "Centro",
    consentimentoLgpd: true,
    createdAt: "2026-10-24T12:10:00.000Z",
    stageEnteredAt: "2026-10-24T14:20:00.000Z",
    planName: null,
    carrierName: null,
    latestMessage: { body: "Queria entender as opções de atendimento e a rede da região.", direction: "incoming", sentAt: "2026-10-24T15:34:00.000Z" },
    messages: [
      { id: "message-1", leadId: "lead-fixture-ana", body: "Olá, gostaria de entender as opções disponíveis para minha família.", direction: "incoming", sentAt: "2026-10-24T15:28:00.000Z" },
      { id: "message-2", leadId: "lead-fixture-ana", body: "Claro, posso te explicar com detalhes. Qual região e hospitais são importantes para vocês?", direction: "outgoing", sentAt: "2026-10-24T15:31:00.000Z" },
      { id: "message-3", leadId: "lead-fixture-ana", body: "Queria entender as opções de atendimento e a rede da região.", direction: "incoming", sentAt: "2026-10-24T15:34:00.000Z" },
    ],
    documents: [],
    aiConversation: { id: "ai-fixture-ana", status: "HUMAN_ACTIVE", aiModel: null, transferReason: "Solicitou atendimento", qualificationSummary: "Busca plano familiar", assignedUserId: "fixture-director" },
    tags: [],
  };
  return renderToStaticMarkup(
    <SidebarProvider>
      <ArcScopeProvider enabled>
        <ConversationsFrame
          role="director"
          branches={[{ id: "branch-centro", name: "Centro" }]}
          conversations={[conversation]}
          initialLeadId={conversation.id}
          userId="fixture-director"
          tenantId="fixture-tenant"
          leadTags={[]}
          canManageTags={false}
          officialBrokerEnabled={false}
          officialBrokerDeliveryChannel="meta"
          officialBrokerConversations={[]}
          canSeeBrokerTab
          currentTab="leads"
          leadsCount={1}
          officialBrokerTab={false}
        />
      </ArcScopeProvider>
    </SidebarProvider>,
  );
}

function normalizeGeneratedCssModuleHash(html: string) {
  return html
    .replace(/\b(?:conversas-lite_root__|_root_)[a-z0-9]+\b/gi, "_root_HASH")
    .replace(/\bid="base-ui-[^"]+"/g, 'id="base-ui-HASH"');
}

function renderOfficialWorkspace(directorSkinEnabled: boolean) {
  navigation.pathname = "/conversas";
  return renderToStaticMarkup(
    <ArcScopeProvider enabled={directorSkinEnabled}>
      <OfficialBrokerConversations enabled={false} deliveryChannel="meta" conversations={[]} />
    </ArcScopeProvider>,
  );
}

describe("pele da central de conversas", () => {
  it("preserva o HTML legado quando a chave está desligada", () => {
    expect(normalizeGeneratedCssModuleHash(renderLegacyWorkspaceSnapshot())).toMatchSnapshot();
  });

  it("usa os marcadores da pele Arc quando a chave está ligada", () => {
    const html = renderWorkspace(true, "/dev/diretor-shell-real");
    expect(html).toContain('data-skin="diretor"');
    expect(html).toContain('data-conversations-part="frame"');
    expect(html).toContain('data-conversations-part="workspace"');
    expect(html).toContain('data-conversations-part="filter-controls"');
    expect(html).toContain('data-conversations-part="director-list-controls"');
    expect(html).toContain('data-conversations-part="inline-actions"');
    expect(html).not.toContain('data-conversations-part="page-actions"');
    expect(html).not.toContain('data-lite=');
    expect(html).not.toContain('data-slot="filter-toolbar"');
  });

  it("mantém rótulos e controles do Diretor em português e sem linha de tags vazia", () => {
    const html = renderSelectedConversation();
    expect(html).toContain('placeholder="Buscar conversa"');
    expect(html).toContain('placeholder="Mensagem"');
    expect(html).toContain('data-conversations-part="message-history"');
    expect(html).toContain('data-conversations-part="composer-input"');
    expect(html).toContain('<textarea');
    expect(html).toContain(">Qualificado</span>");
    expect(html).not.toMatch(/>qualified<\/span>/i);
    expect(html).not.toContain("Sem tags");
    expect(html).toContain('aria-label="Ações do atendimento"');
    expect(html).toContain('data-variant="outline"');
    expect(html).toContain('data-conversations-part="row-owner-name"');
    expect(html).toContain('data-conversations-part="header-owner-name"');
    expect(html).toContain("Marina Exemplo");
  });

  it("omite o nome do corretor quando o lead nao esta atribuido", () => {
    const html = renderSelectedConversation(null);
    expect(html).not.toContain('data-conversations-part="row-owner-name"');
    expect(html).not.toContain('data-conversations-part="header-owner-name"');
  });

  it("mostra a aba Distribuídos e sua contagem da lista ativa", () => {
    const html = renderToStaticMarkup(
      <ArcScopeProvider enabled>
        <ConversasHeaderNav currentTab="distribuidos" distributedCount={12} />
      </ArcScopeProvider>,
    );
    expect(html).toContain('href="/conversas?tab=distribuidos"');
    expect(html).toContain(">Distribuídos</span>");
    expect(html).toContain(">12</span>");
  });

  it("mantem a pele desligada enquanto a rota continua no opt-out", () => {
    const html = renderWorkspace(true, "/conversas/broker");
    expect(html).not.toContain('data-skin="diretor"');
    expect(html).toContain('data-lite="frame"');
    expect(html).toContain('data-lite="workspace"');
  });

  it("preserva o HTML legado da aba oficial quando a chave está desligada", () => {
    expect(renderOfficialWorkspace(false)).toMatchSnapshot();
  });

  it("marca a aba oficial para a pele Arc quando a chave está ligada", () => {
    expect(renderOfficialWorkspace(true)).toContain('data-conversations-part="official-workspace"');
  });

  it("preserva a navegação do topo sem atributos novos quando a chave está desligada", () => {
    const html = renderToStaticMarkup(
      <ArcScopeProvider enabled={false}>
        <ConversasHeaderNav currentTab="leads" leadsCount={3} />
      </ArcScopeProvider>,
    );
    expect(html).toMatchSnapshot();
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/conversas" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { ArcScopeProvider } from "@/components/arc/arc-scope-context";
import { isDirectorLiteRouteOptedOut } from "@/components/arc/director-lite-routes";
import { ConversationsFrame } from "./conversations-frame";
import { ConversationsWorkspace, type ConversationItem } from "./conversations-workspace";
import { OfficialBrokerConversations } from "./official-broker-conversations";
import { ConversasHeaderNav } from "./_components/conversas-header-nav";

function renderWorkspace(enabled: boolean, pathname = "/conversas") {
  navigation.pathname = pathname;
  return renderToStaticMarkup(
    <ArcScopeProvider enabled={enabled && !isDirectorLiteRouteOptedOut(pathname)}>
      <ConversationsFrame
        legacyHeader={<header data-slot="dashboard-header">Conversas</header>}
        directorHeader={<header data-slot="dashboard-header">Conversas</header>}
      >
        <ConversationsWorkspace
          role="director"
          branches={[]}
          conversations={[]}
          userId="fixture-director"
          tenantId="fixture-tenant"
          directorActions={<nav aria-label="Ações da central">Ações</nav>}
        />
      </ConversationsFrame>
    </ArcScopeProvider>,
  );
}

function renderSelectedConversation() {
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
    corretorId: "fixture-director",
    corretorNome: "Marina Exemplo",
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
    <ArcScopeProvider enabled>
      <ConversationsFrame
        legacyHeader={<header data-slot="dashboard-header">Conversas</header>}
        directorHeader={<header data-slot="dashboard-header">Conversas</header>}
      >
        <ConversationsWorkspace
          role="director"
          branches={[{ id: "branch-centro", name: "Centro" }]}
          conversations={[conversation]}
          initialLeadId={conversation.id}
          userId="fixture-director"
          tenantId="fixture-tenant"
          directorActions={<nav aria-label="Tipo de conversa"><a href="/conversas">Leads</a></nav>}
        />
      </ConversationsFrame>
    </ArcScopeProvider>,
  );
}

function normalizeGeneratedCssModuleHash(html: string) {
  return html.replace(/\b(?:conversas-lite_root__|_root_)[a-z0-9]+\b/gi, "_root_HASH");
}

function renderOfficialWorkspace(directorSkinEnabled: boolean) {
  return renderToStaticMarkup(
    <ArcScopeProvider enabled={directorSkinEnabled}>
      <OfficialBrokerConversations enabled={false} deliveryChannel="meta" conversations={[]} />
    </ArcScopeProvider>,
  );
}

describe("pele da central de conversas", () => {
  it("preserva o HTML legado quando a chave está desligada", () => {
    expect(normalizeGeneratedCssModuleHash(renderWorkspace(false))).toMatchSnapshot();
  });

  it("usa os marcadores da pele Arc quando a chave está ligada", () => {
    const html = renderWorkspace(true, "/dev/diretor-shell-real");
    expect(html).toContain('data-skin="diretor"');
    expect(html).toContain('data-conversations-part="frame"');
    expect(html).toContain('data-conversations-part="workspace"');
    expect(html).toContain('data-conversations-part="filter-controls"');
    expect(html).toContain('data-conversations-part="inline-actions"');
    expect(html).not.toContain('data-conversations-part="page-actions"');
    expect(html).not.toContain('data-lite=');
  });

  it("mantém rótulos e controles do Diretor em português e sem linha de tags vazia", () => {
    const html = renderSelectedConversation();
    expect(html).toContain('placeholder="Buscar conversa"');
    expect(html).toContain('placeholder="Escreva uma mensagem"');
    expect(html).toContain(">Qualificado</span>");
    expect(html).not.toMatch(/>qualified<\/span>/i);
    expect(html).not.toContain("Sem tags");
    expect(html).toContain('aria-label="Ações do atendimento"');
    expect(html).toContain('data-variant="outline"');
  });

  it("mantem a pele desligada enquanto a rota continua no opt-out", () => {
    const html = renderWorkspace(true, "/conversas");
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

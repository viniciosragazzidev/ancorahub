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
import { ConversationsWorkspace } from "./conversations-workspace";
import { OfficialBrokerConversations } from "./official-broker-conversations";
import { ConversasHeaderNav } from "./_components/conversas-header-nav";

function renderWorkspace(enabled: boolean, pathname = "/conversas") {
  navigation.pathname = pathname;
  return renderToStaticMarkup(
    <ArcScopeProvider enabled={enabled && !isDirectorLiteRouteOptedOut(pathname)}>
      <ConversationsFrame
        legacyHeader={<header data-slot="dashboard-header">Conversas</header>}
        directorHeader={<header data-slot="dashboard-header">Conversas</header>}
        pageActions={<nav aria-label="Ações da central">Ações</nav>}
      >
        <ConversationsWorkspace
          role="director"
          branches={[]}
          conversations={[]}
          userId="fixture-director"
          tenantId="fixture-tenant"
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
    expect(html).toContain('data-conversations-part="page-actions"');
    expect(html).not.toContain('data-lite=');
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

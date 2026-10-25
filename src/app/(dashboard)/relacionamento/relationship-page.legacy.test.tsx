// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Central de relacionamento do diretor com a chave desligada: o HTML de cada aba precisa continuar igual ao de antes
// do Lite. O snapshot foi gerado com o page.tsx original, com o banco, a sessão e as Server Actions trocados por dados fixos.
const fixtures = vi.hoisted(() => ({
  context: { role: "director", tenantId: "tenant-1", userId: "director-1", branchId: null, jobTitle: "director" },
  liteStyle: { current: false },
}));

vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => fixtures.context }));
vi.mock("@/features/broker-workspace/lite-audience", () => ({ getLiteAudience: async () => null }));
vi.mock("@/features/system-settings/queries", async () => ({
  FEATURE_FLAGS: (await import("@/shared/feature-flags/catalog")).FEATURE_FLAGS,
  getFeatureFlag: async () => "true",
  getSystemSetting: async () => null,
}));
vi.mock("@/features/relationship/audience", async () => {
  const { relationshipOptionsFixture } = await import("@/features/relationship/components/director-lite/fixtures");
  return { canSend: () => true, getAudienceOptions: async () => relationshipOptionsFixture };
});
vi.mock("@/features/relationship/service", async () => {
  const { relationshipHistoryFixture } = await import("@/features/relationship/components/director-lite/fixtures");
  return {
    listBroadcasts: async () => relationshipHistoryFixture.map((item) => ({ ...item, createdAt: new Date(item.createdAt) })),
    listBrokerInbox: async () => [],
  };
});
vi.mock("@/features/journey/director-queries", async () => {
  const { journeyDataFixture } = await import("@/features/relationship/components/director-lite/fixtures");
  return { getDirectorJourneyPageData: async () => journeyDataFixture };
});
vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => ({}) }));
vi.mock("@/features/leads/lead-authorization", () => ({ buildLeadScopeWhere: () => undefined }));
vi.mock("@/features/director-lite/style-flag", () => ({ isDirectorLitePageOnServer: async () => fixtures.liteStyle.current }));
vi.mock("@/components/dashboard-header", () => ({
  DashboardHeader: ({ breadcrumb, title }: { breadcrumb?: string; title?: string }) => <header data-testid="dashboard-header">{breadcrumb} / {title}</header>,
}));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound"); },
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/relacionamento",
}));
// Server Actions ("use server") ficam fora do teste: cada uma vira uma função vazia.
const serverModule = vi.hoisted(() => () => new Proxy({}, { has: (_target, key) => key !== "then", get: (_target, key) => (key === "then" || key === "__esModule" ? undefined : async () => ({ ok: true, data: { count: 0, names: [] } })) }));
vi.mock("@/features/relationship/actions", serverModule);
vi.mock("@/features/journey/campaign-actions", serverModule);
vi.mock("@/features/journey/director-actions", serverModule);

import { ArcScopeProvider } from "@/components/arc/arc-scope-context";

import RelationshipPage from "./page";

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T15:00:00.000Z"));
});

afterEach(cleanup);

async function renderPage(lite: boolean) {
  fixtures.liteStyle.current = lite;
  const tree = (await RelationshipPage({ searchParams: Promise.resolve({}) })) as ReactElement;
  fixtures.liteStyle.current = false;
  return render(lite ? <ArcScopeProvider enabled>{tree}</ArcScopeProvider> : tree);
}

describe("/relacionamento do diretor com a chave desligada", () => {
  it("preserva o HTML legado de mensagens e de cada aba da jornada", async () => {
    const { container } = await renderPage(false);
    expect(screen.getByText("Nova mensagem")).toBeInTheDocument();
    expect(container.innerHTML).toMatchSnapshot("mensagens");
    fireEvent.click(screen.getByRole("tab", { name: "Jornada da equipe" }));
    expect(container.innerHTML).toMatchSnapshot("jornada visão geral");
    for (const name of ["Campanhas", "Regras", "Auditoria"]) {
      fireEvent.click(screen.getByRole("tab", { name: new RegExp(`^${name}`) }));
      expect(container.innerHTML).toMatchSnapshot(`jornada ${name.toLowerCase()}`);
    }
  }, 30_000);
});

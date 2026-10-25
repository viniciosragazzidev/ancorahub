// Snapshot do HTML das visões gerais órfãs (/conversas/dashboard, /equipe/dashboard, /vendas/dashboard e
// /leads/dashboard) com a chave desligada, tirado antes da pele Lite do diretor.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  liteKey: { on: false },
  context: { role: "director", tenantId: "t1", userId: "u1" } as { role: string; tenantId: string; userId: string },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("@/features/dashboard/service", () => ({
  getDomainDashboard: async (_context: unknown, kind: string) => ({
    title: `Painel ${kind}`,
    description: `Resumo de ${kind} no seu escopo.`,
    metrics: [{ label: "Abertas", value: 12 }, { label: "Sem resposta", value: 3 }, { label: "Taxa", value: "40%" }],
    actionHref: `/${kind}`,
  }),
}));
vi.mock("@/features/reports/metrics/metrics-service", () => ({
  getCommercialOverview: async () => ({ conversion: { rate: 12.345 } }),
  getFunnelSnapshot: async () => ({ received: 9, rows: [{ stage: "Novo", inStage: 4 }, { stage: "Em contato", inStage: 3 }, { stage: "Proposta", inStage: 2 }] }),
  getAttentionSnapshot: async () => ({ items: [
    { id: "high-intent-unassigned", title: "Alta intenção sem responsável", description: "Leads quentes parados", count: 2, href: "/leads?f=1" },
    { id: "no-contact", title: "Sem contato", description: "Nenhuma mensagem enviada", count: 0, href: "/leads?f=2" },
  ] }),
}));
vi.mock("@/features/director-lite/style-flag", async () => {
  const { isDirectorLiteRouteOptedOut } = await import("@/components/arc/director-lite-routes");
  return { isDirectorLitePageOnServer: async (role: string, _tenantId: string, pathname: string) => role === "director" && state.liteKey.on && !isDirectorLiteRouteOptedOut(pathname) };
});
vi.mock("@/components/dashboard-header", () => ({ DashboardHeader: ({ breadcrumb, title }: { breadcrumb: string; title: string }) => <header data-stub="dashboard-header">{breadcrumb} / {title}</header> }));

import ConversationsDashboardPage from "@/app/(dashboard)/conversas/dashboard/page";
import TeamDashboardPage from "@/app/(dashboard)/equipe/dashboard/page";
import SalesDashboardPage from "@/app/(dashboard)/vendas/dashboard/page";
import LeadsDashboardPage from "@/app/(dashboard)/leads/dashboard/page";

const PAGES = [
  ["/conversas/dashboard", ConversationsDashboardPage],
  ["/equipe/dashboard", TeamDashboardPage],
  ["/vendas/dashboard", SalesDashboardPage],
  ["/leads/dashboard", LeadsDashboardPage],
] as const;

beforeEach(() => {
  state.context = { role: "director", tenantId: "t1", userId: "u1" };
  state.liteKey.on = false;
});

describe("visões gerais órfãs com a chave desligada", () => {
  it.each(PAGES)("%s", async (_route, Page) => {
    expect(renderToStaticMarkup(await Page())).toMatchSnapshot();
  });
});

describe("visões gerais órfãs com a chave ligada", () => {
  it.each(PAGES)("%s ganha só a pele Lite, com os mesmos números", async (_route, Page) => {
    state.liteKey.on = true;
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain('data-skin="diretor"');
    expect(html).not.toContain("p-(--mobile-page-padding)");
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("—");
  });

  it("leads mantém gargalos com link e as etapas do funil", async () => {
    state.liteKey.on = true;
    const html = renderToStaticMarkup(await LeadsDashboardPage());
    expect(html).toContain('href="/leads?f=1"');
    expect(html).not.toContain('href="/leads?f=2"');
    expect(html).toContain("12,3%");
    expect(html).toContain("Em contato");
  });

  it.each(PAGES)("%s fica igual para quem não é diretor", async (_route, Page) => {
    state.liteKey.on = true;
    state.context = { role: "manager", tenantId: "t1", userId: "u2" };
    const on = renderToStaticMarkup(await Page());
    state.liteKey.on = false;
    expect(on).toBe(renderToStaticMarkup(await Page()));
  });
});


// Snapshot do HTML de /clientes na versão completa (chave desligada), tirado antes da versão Lite do diretor.
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  liteKey: { on: false },
  context: { role: "director", tenantId: "t1", userId: "u1" } as { role: string; tenantId: string; userId: string },
  results: [] as unknown[][],
  liteAudience: null as null | "broker" | "supervisor" | "manager",
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/clientes",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));
vi.mock("@/shared/db", () => {
  const make = () => {
    const rows = state.results.shift() ?? [];
    const chain: Record<string, unknown> = {};
    for (const key of ["from", "where", "orderBy", "leftJoin", "innerJoin", "limit", "offset"]) chain[key] = () => chain;
    (chain as { then: unknown }).then = (resolve: (value: unknown[]) => unknown) => resolve(rows);
    return chain;
  };
  return { getDatabase: () => ({ select: () => make() }), schema: new Proxy({}, { get: () => new Proxy({}, { get: () => ({}) }) }) };
});
vi.mock("drizzle-orm", () => ({ and: () => ({}), count: () => ({}), desc: () => ({}), eq: () => ({}), gte: () => ({}), countDistinct: () => ({}) }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("@/features/customers/customer-authorization", () => ({ buildClientScopeWhere: () => ({}) }));
vi.mock("@/features/leads/lead-authorization", () => ({ buildLeadScopeWhere: () => ({}) }));
vi.mock("@/features/broker-workspace/experience-mode", () => ({ getExperienceMode: async () => "FULL" }));
vi.mock("@/features/broker-workspace/lite-audience", () => ({ getLiteAudience: async () => state.liteAudience }));
vi.mock("@/features/broker-workspace/components/light-clients-list", () => ({ LightClientsList: ({ management }: { management?: boolean }) => <div data-stub={`light-clients${management ? "-management" : ""}`} /> }));
vi.mock("@/features/director-lite/style-flag", async () => {
  const { isDirectorLiteRouteOptedOut } = await import("@/components/arc/director-lite-routes");
  return { isDirectorLitePageOnServer: async (context: { role: string }, pathname: string) => !["broker", "supervisor"].includes(context.role) && state.liteKey.on && !isDirectorLiteRouteOptedOut(pathname) };
});
vi.mock("@/components/dashboard-header", () => ({ DashboardHeader: ({ breadcrumb, title }: { breadcrumb: string; title: string }) => <header data-stub="dashboard-header">{breadcrumb} / {title}</header> }));
vi.mock("@/components/branch-select", () => ({ BranchSelect: () => <div data-stub="branch-select" /> }));
vi.mock("@/components/period-select", () => ({ PeriodSelect: ({ value }: { value: number }) => <div data-stub={`period-${value}`} /> }));

import CustomersPage from "./page";

const clients = [
  { id: "c1", leadId: "l1", name: "Ana Ribeiro", phone: "+55 11 99999-0101", email: "ana@example.test", convertedAt: new Date("2026-10-20T15:00:00.000Z"), brokerName: "Marina Exemplo", branchName: "Centro" },
  { id: "c2", leadId: "l2", name: "Bruno Martins", phone: "+55 11 99999-0102", email: null, convertedAt: new Date("2026-10-18T15:00:00.000Z"), brokerName: null, branchName: null },
];

function queueFullResults() {
  state.results = [
    [{ id: "b1", name: "Centro" }, { id: "b2", name: "Zona Norte" }],
    clients,
    [{ total: 2 }],
    [{ total: 40 }],
    [{ total: 1 }],
    [{ total: 3 }],
    [{ total: 2 }],
  ];
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T16:00:00.000Z"));
});
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  state.context = { role: "director", tenantId: "t1", userId: "u1" };
  state.liteAudience = null;
  state.liteKey.on = false;
});

describe("/clientes com a chave desligada", () => {
  it("diretor vê a versão completa de hoje", async () => {
    queueFullResults();
    const html = renderToStaticMarkup(await CustomersPage({ searchParams: Promise.resolve({}) }));
    expect(html).toMatchSnapshot();
  });

  it("gestor normal vê a versão completa de hoje", async () => {
    state.context = { role: "manager", tenantId: "t1", userId: "u2" };
    queueFullResults();
    const html = renderToStaticMarkup(await CustomersPage({ searchParams: Promise.resolve({ period: "7" }) }));
    expect(html).toMatchSnapshot();
  });

  it("gestor Lite continua com a lista leve", async () => {
    state.context = { role: "manager", tenantId: "t1", userId: "u2" };
    state.liteAudience = "manager";
    state.liteKey.on = true;
    state.results = [[{ id: "b1", name: "Centro" }], []];
    const html = renderToStaticMarkup(await CustomersPage({ searchParams: Promise.resolve({}) }));
    expect(html).toBe('<div data-stub="light-clients-management"></div>');
  });
});

describe("/clientes com a chave ligada", () => {
  it("diretor vê a versão Lite com os mesmos dados", async () => {
    state.liteKey.on = true;
    queueFullResults();
    const html = renderToStaticMarkup(await CustomersPage({ searchParams: Promise.resolve({ branch: "b1" }) }));
    expect(html).toContain('data-skin="diretor"');
    expect(html).toContain('data-lite="table"');
    expect(html).toContain("Ana Ribeiro");
    expect(html).toContain('href="/clientes/c1"');
    expect(html).not.toContain("Carteira de clientes ativos</div>");
    expect(html).not.toContain('data-stub="branch-select"');
  });

  it("gestor no modo normal também troca para o Lite com a chave ligada", async () => {
    state.liteKey.on = true;
    state.context = { role: "manager", tenantId: "t1", userId: "u2" };
    queueFullResults();
    const html = renderToStaticMarkup(await CustomersPage({ searchParams: Promise.resolve({ period: "7" }) }));
    state.liteKey.on = false;
    queueFullResults();
    const off = renderToStaticMarkup(await CustomersPage({ searchParams: Promise.resolve({ period: "7" }) }));
    expect(html).not.toBe(off);
  });
});

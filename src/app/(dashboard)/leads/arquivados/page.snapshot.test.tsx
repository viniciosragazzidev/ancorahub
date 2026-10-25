// Snapshot do HTML de /leads/arquivados de hoje (chave desligada), tirado antes da versão Lite do diretor.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  liteKey: { on: false },
  context: { role: "director", tenantId: "t1", userId: "u1" } as { role: string; tenantId: string; userId: string },
  results: [] as unknown[][],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/leads/arquivados",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn((href: string) => { throw new Error(`NEXT_REDIRECT:${href}`); }),
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
vi.mock("drizzle-orm", () => ({ and: () => ({}), asc: () => ({}), count: () => ({}), eq: () => ({}), ilike: () => ({}), isNotNull: () => ({}), isNull: () => ({}), or: () => ({}) }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("@/features/director-lite/style-flag", async () => {
  const { isDirectorLiteRouteOptedOut } = await import("@/components/arc/director-lite-routes");
  return { isDirectorLitePageOnServer: async (context: { role: string }, pathname: string) => context.role === "director" && state.liteKey.on && !isDirectorLiteRouteOptedOut(pathname) };
});
vi.mock("@/components/dashboard-header", () => ({ DashboardHeader: ({ breadcrumb, title }: { breadcrumb: string; title: string }) => <header data-stub="dashboard-header">{breadcrumb} / {title}</header> }));

import ArchivedLeadsPage from "./page";

const rows = [
  { id: "l1", name: "Ana Ribeiro", phone: "+55 11 99999-0101", email: "ana@example.test", status: "lost", qualificationStatus: "unqualified", createdAt: new Date("2026-09-01T12:00:00.000Z"), archivedAt: new Date("2026-10-20T15:30:00.000Z"), archivedBy: "Marina Exemplo" },
  { id: "l2", name: "Bruno Martins", phone: "+55 11 99999-0102", email: null, status: null, qualificationStatus: null, createdAt: new Date("2026-09-02T12:00:00.000Z"), archivedAt: null, archivedBy: null },
];

beforeEach(() => {
  state.context = { role: "director", tenantId: "t1", userId: "u1" };
  state.liteKey.on = false;
});

describe("/leads/arquivados com a chave desligada", () => {
  it("lista com busca e paginação", async () => {
    state.results = [rows, [{ total: 120 }]];
    const html = renderToStaticMarkup(await ArchivedLeadsPage({ searchParams: Promise.resolve({ page: "2", search: "ana" }) }));
    expect(html).toMatchSnapshot();
  });

  it("estado vazio", async () => {
    state.results = [[], [{ total: 0 }]];
    const html = renderToStaticMarkup(await ArchivedLeadsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toMatchSnapshot();
  });

  it("quem não é diretor vai para acesso negado", async () => {
    state.context = { role: "manager", tenantId: "t1", userId: "u2" };
    await expect(ArchivedLeadsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT:/access-denied");
  });
});

describe("/leads/arquivados com a chave ligada", () => {
  it("diretor vê a lista Lite com a mesma busca e página", async () => {
    state.liteKey.on = true;
    state.results = [rows, [{ total: 120 }]];
    const html = renderToStaticMarkup(await ArchivedLeadsPage({ searchParams: Promise.resolve({ page: "2", search: "ana" }) }));
    expect(html).toContain('data-skin="diretor"');
    expect(html).toContain('data-lite="table"');
    expect(html).toContain('name="search"');
    expect(html).toContain('value="ana"');
    expect(html).toContain("51 a 100 de 120");
    expect(html).toContain("Perdido");
    expect(html).toContain("Sem data");
    expect(html).not.toContain("—");
  });
});


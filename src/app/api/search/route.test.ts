import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  managerLite: "false",
  select: vi.fn(),
  displayUser: {
    roleKey: "manager" as "manager" | "broker",
    jobTitle: "manager" as "manager" | "broker",
    permissions: [] as string[],
    relationshipCenterEnabled: false,
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => conditions,
  eq: vi.fn(),
  ilike: vi.fn(),
  inArray: vi.fn(),
  isNull: vi.fn(),
  or: (...conditions: unknown[]) => conditions,
}));
vi.mock("@/features/team/supervisor-scope", () => ({ inSupervisorTeam: vi.fn(), isSupervisorTeamScoped: vi.fn(() => false) }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: vi.fn(async () => ({
  tenantId: "tenant-1", userId: "manager-1", role: "manager", branchId: null,
})) }));
vi.mock("@/shared/auth/actions", () => ({ getUserDisplayInfo: vi.fn(async () => state.displayUser) }));
vi.mock("@/features/system-settings/queries", () => ({
  FEATURE_FLAGS: { MANAGER_LITE: { key: "feature_manager_lite_enabled" } },
  getFeatureFlag: vi.fn(async () => state.managerLite),
  getSystemSetting: vi.fn(async () => "true"),
}));
vi.mock("@/shared/db", () => {
  const query = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    limit: vi.fn(async () => []),
  };
  return { getDatabase: () => ({ select: state.select.mockImplementation(() => query) }), schema: {
    leads: { tenantId: "leads.tenantId", deletedAt: "leads.deletedAt", corretorId: "leads.corretorId", id: "leads.id", nome: "leads.nome", telefone: "leads.telefone", email: "leads.email", status: "leads.status" },
    clients: { tenantId: "clients.tenantId", branchId: "clients.branchId", corretorId: "clients.corretorId", id: "clients.id", nome: "clients.nome", telefone: "clients.telefone", email: "clients.email", leadId: "clients.leadId" },
    leadTasks: { tenantId: "tasks.tenantId", leadId: "tasks.leadId", title: "tasks.title", description: "tasks.description" },
    user: { id: "user.id", name: "user.name", email: "user.email" },
    tenantMemberships: { tenantId: "members.tenantId", status: "members.status", branchId: "members.branchId", userId: "members.userId", supervisorId: "members.supervisorId" },
  } };
});

import { GET } from "./route";

describe("manager search without a unit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.managerLite = "false";
    state.displayUser.roleKey = "manager";
    state.displayUser.jobTitle = "manager";
    state.displayUser.permissions = [];
  });

  it("preserves the pre-Lite search when the manager flag is off", async () => {
    const response = await GET(new NextRequest("http://localhost/api/search?q=lead"));
    expect(response.status).toBe(200);
    expect(state.select).toHaveBeenCalled();
  });

  it("limits the no-unit empty search behavior to enabled Manager Lite", async () => {
    state.managerLite = "true";
    const response = await GET(new NextRequest("http://localhost/api/search?q=lead"));
    expect(response.status).toBe(200);
    expect(state.select).not.toHaveBeenCalled();
  });

  it("returns only feature results permitted by the menu access policy", async () => {
    state.displayUser.permissions = ["acessar_leads"];
    const response = await GET(new NextRequest("http://localhost/api/search?q=lead"));
    const payload = await response.json() as { groups: Array<{ type: string; items: Array<{ title: string }> }> };
    const features = payload.groups.find((group) => group.type === "features")?.items ?? [];

    expect(features.some((item) => item.title === "Gestão de Leads")).toBe(true);
    expect(features.some((item) => item.title === "Regras de Distribuição de Leads")).toBe(false);
  });

  it("does not expose hidden broker destinations through the feature search", async () => {
    state.displayUser.roleKey = "broker";
    state.displayUser.jobTitle = "broker";
    state.displayUser.permissions = ["acessar_cotacoes"];
    const response = await GET(new NextRequest("http://localhost/api/search?q=simulador"));
    const payload = await response.json() as { groups: Array<{ type: string; items: Array<{ title: string }> }> };
    const features = payload.groups.find((group) => group.type === "features")?.items ?? [];

    expect(features).toHaveLength(0);
  });
});

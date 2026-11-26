import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import type { AccessContext } from "@/shared/auth/access-context";

vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: vi.fn(async () => undefined) }));

import { forecastLeadWhere } from "./monthly-forecast-query";

function context(overrides: Partial<AccessContext>): AccessContext {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    role: "broker",
    jobTitle: "broker",
    branchId: "unit-a",
    canAccessAllUnits: false,
    allowedUnitIds: ["unit-a"],
    permissions: new Set(["acessar_leads"]),
    scopeType: "SELF",
    scope: { tenantWide: false, unitIds: ["unit-a"], teamIds: [], ownership: "SELF", provenance: { units: "SELF_BROKER" } },
    ...overrides,
  };
}

const render = (ctx: AccessContext, branch?: string | null) => new PgDialect().sqlToQuery(forecastLeadWhere(ctx, branch));

describe("escopo da previsão do mês", () => {
  it("corretor: só os leads dele, nas etapas abertas", () => {
    const query = render(context({}));
    expect(query.sql).toContain("\"corretor_id\" = $");
    expect(query.params).toContain("user-1");
    expect(query.params).toContain("tenant-1");
    expect(query.params).toContain("negotiation");
    expect(query.params).not.toContain("converted");
    expect(query.params).not.toContain("lost");
    expect(query.sql).toContain("\"deleted_at\" is null");
    expect(query.sql).toContain("\"archived_at\" is null");
  });

  it("gestor: só a unidade dele, e filial de fora não devolve nada", () => {
    const manager = context({
      userId: "user-mgr",
      role: "manager",
      jobTitle: "manager",
      scopeType: "UNITS",
      scope: { tenantWide: false, unitIds: ["unit-a"], teamIds: [], ownership: "SCOPED", provenance: { units: "LEGACY_MEMBERSHIP_BRANCH" } },
    });
    const query = render(manager);
    expect(query.sql).toContain("\"branch_id\" in");
    expect(query.params).toContain("unit-a");
    expect(query.params).not.toContain("user-mgr");
    expect(render(manager, "unit-z").sql).toContain("false");
  });

  it("supervisor com escopo de equipe: só os corretores da equipe", () => {
    const supervisor = context({
      userId: "user-sup",
      role: "supervisor",
      jobTitle: "supervisor",
      scopeType: "UNITS",
      supervisorTeamScope: true,
      scope: { tenantWide: false, unitIds: ["unit-a"], teamIds: [], ownership: "SCOPED", provenance: { units: "LEGACY_MEMBERSHIP_BRANCH" } },
    });
    const query = render(supervisor);
    expect(query.sql).toContain("supervisor_id");
    expect(query.params).toContain("user-sup");
  });

  it("diretor: a empresa toda, com filtro de filial opcional", () => {
    const director = context({
      userId: "user-dir",
      role: "director",
      jobTitle: "director",
      canAccessAllUnits: true,
      allowedUnitIds: [],
      scopeType: "GLOBAL",
      scope: { tenantWide: true, unitIds: [], teamIds: [], ownership: "ANY", provenance: { units: "TENANT_WIDE" } },
    });
    const all = render(director);
    expect(all.params).toContain("tenant-1");
    expect(all.params).not.toContain("user-dir");
    expect(all.sql).not.toContain("\"corretor_id\" = $");
    expect(render(director, "unit-b").params).toContain("unit-b");
  });

  it("sem a permissão de leads, nada entra", () => {
    expect(render(context({ permissions: new Set() })).sql).toContain("false");
  });
});

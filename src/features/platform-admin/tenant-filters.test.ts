import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ wheres: [] as unknown[] }));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/auth/platform-admin", () => ({ getRequiredPlatformAdmin: async () => ({ userId: "admin-1" }) }));
vi.mock("@/shared/db", async () => {
  const schema = await import("@/shared/db/schema");
  function chain() {
    const builder: Record<string, unknown> = {};
    for (const name of ["from", "innerJoin", "orderBy", "limit"]) builder[name] = () => builder;
    builder.where = (condition: unknown) => {
      state.wheres.push(condition);
      return builder;
    };
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve([]).then(resolve);
    return builder;
  }
  return { schema, getDatabase: () => ({ select: () => chain() }) };
});

import { getPlatformAuditLogs, getTenantAuditLogs, normalizeAuditTenantId } from "./service";
import { buildTenantAlertRows, tenantAdminHref } from "./tenant-alerts-core";
import { auditTenantOptions } from "@/components/platform-admin-audit-tenant-filter";

const dialect = new PgDialect();
const render = (condition: unknown) => dialect.sqlToQuery(condition as SQL);

beforeEach(() => {
  state.wheres = [];
});

describe("filtro por empresa da auditoria (?tenant=)", () => {
  it("só aceita id curto de texto", () => {
    expect(normalizeAuditTenantId(" t-1 ")).toBe("t-1");
    expect(normalizeAuditTenantId("")).toBeNull();
    expect(normalizeAuditTenantId("a' or 1=1")).toBeNull();
    expect(normalizeAuditTenantId("x".repeat(65))).toBeNull();
    expect(normalizeAuditTenantId(undefined)).toBeNull();
  });

  it("sem empresa, nada muda: os dois logs vêm sem filtro", async () => {
    await getPlatformAuditLogs();
    await getTenantAuditLogs();
    expect(state.wheres).toEqual([undefined, undefined]);
  });

  it("com empresa, a plataforma filtra pelo alvo ou metadata e a operação pelos membros da empresa", async () => {
    await getPlatformAuditLogs(100, "t-1");
    await getTenantAuditLogs("t-1");
    const platform = render(state.wheres[0]);
    expect(platform.sql).toContain("\"target_id\" =");
    expect(platform.sql).toContain("->>'tenantId'");
    expect(platform.params).toEqual(["t-1", "t-1"]);
    const tenant = render(state.wheres[1]);
    expect(tenant.sql).toContain("\"tenant_memberships\"");
    expect(tenant.sql).not.toContain("metadata");
    expect(tenant.params).toEqual(["t-1"]);
  });

  it("opções: todas as empresas primeiro, depois cada empresa pelo nome", () => {
    expect(auditTenantOptions([{ id: "t-1", name: "Âncora" }])).toEqual([
      { value: "", label: "Todas as empresas" },
      { value: "t-1", label: "Âncora" },
    ]);
  });
});

describe("alertas por empresa (visão geral)", () => {
  const tenants = [
    { id: "a", name: "Alfa", status: "active" },
    { id: "b", name: "Beta", status: "inactive" },
    { id: "c", name: "Corre", status: "active" },
  ];

  it("soma alertas e perguntas abertas, quem tem mais pendência vem primeiro", () => {
    const rows = buildTenantAlertRows(tenants, new Map([["a", 0], ["b", 1], ["c", 2]]), new Map([["b", 3]]));
    expect(rows.map((row) => [row.tenantId, row.openAlerts, row.openQuestions])).toEqual([["b", 1, 3], ["c", 2, 0], ["a", 0, 0]]);
    expect(rows[0].active).toBe(false);
  });

  it("sem a tabela das perguntas ou sem conseguir contar, a célula fica sem número", () => {
    const rows = buildTenantAlertRows(tenants, new Map([["a", null]]), null);
    expect(rows.every((row) => row.openQuestions === null)).toBe(true);
    expect(rows.find((row) => row.tenantId === "a")?.openAlerts).toBeNull();
  });

  it("a linha leva à empresa no super-admin", () => {
    expect(tenantAdminHref("t 1")).toBe("/super-admin/tenants/t%201");
  });
});

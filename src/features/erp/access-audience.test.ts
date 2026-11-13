import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ getDatabase: vi.fn(), schema: {} }));

import type { TenantContext } from "@/shared/auth/types";
import { decideErpAccess, erpAudiences, type ErpBase } from "./access";

const director: TenantContext = { tenantId: "tenant-a", userId: "actor-a", role: "director", jobTitle: "broker", branchId: "branch-a" };
const row = (moduleKey: string, roles: string[]) => ({ moduleKey, enabled: true, roles, params: {} });
const base = (context: TenantContext, roles: string[]) => ({
  context, platform: { enabled: true, modules: ["analytics", "tv"] },
  settings: [row("analytics", roles), row("tv", roles)],
  access: { capabilities: new Set(["erp_view_analytics"]) },
  cargo: { tenantWide: true, ownership: "ANY", unitIds: [] }, supervisedIds: [],
}) as unknown as ErpBase;

describe("perfis do ERP: cargo e função somam", () => {
  it("o Diretor com função de corretor entra no módulo liberado para Diretor", () => {
    expect(erpAudiences(director)).toEqual(["director", "broker"]);
    expect(decideErpAccess(base(director, ["director"]), "tv", "erp_view_analytics").scope).toEqual({ mode: "tenant" });
  });
  it("a função também libera: um corretor com função Financeiro entra no módulo do Financeiro", () => {
    const finance = { ...director, role: "broker" as const, jobTitle: "finance" as const };
    expect(() => decideErpAccess(base(finance, ["finance"]), "tv", "erp_view_analytics")).not.toThrow();
  });
  it("quem não tem nenhum dos perfis marcados continua fora", () => {
    const broker = { ...director, role: "broker" as const, jobTitle: "broker" as const };
    expect(() => decideErpAccess(base(broker, ["director"]), "tv", "erp_view_analytics")).toThrow("não está liberado para seu perfil");
  });
});

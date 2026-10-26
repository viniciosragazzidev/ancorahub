import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ getDatabase: vi.fn(), schema: {} }));

import { getManagerUnitScope } from "@/features/broker-workspace/manager-unit-scope";
import { resolveTeamMetricsScope } from "@/features/team-management/scope";
import { deriveUnitContext } from "./director-unit-context";

describe("contexto de unidade do diretor em /gestao", () => {
  it("vira gestor da unidade escolhida, na mesma empresa, sem escopo de cargo personalizado", () => {
    const unit = deriveUnitContext({ userId: "d1", tenantId: "t1", role: "director", jobTitle: "director", branchId: null, customRoleId: "r1", customRoleScope: null }, "b2");
    expect(unit).toMatchObject({ userId: "d1", tenantId: "t1", role: "manager", branchId: "b2", customRoleId: null });
    expect(getManagerUnitScope(unit)).toEqual({ tenantId: "t1", branchId: "b2" });
    expect(resolveTeamMetricsScope(unit)).toEqual({ kind: "unit", tenantId: "t1", branchId: "b2" });
  });
});

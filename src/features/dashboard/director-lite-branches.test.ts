import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ getDatabase: () => ({}), schema: {} }));
vi.mock("@/shared/auth/access-context", () => ({ resolveAccessContext: async () => ({}) }));
vi.mock("@/features/reports/metrics/metric-scope", () => ({ resolveReportDataScope: async () => ({}) }));

import { resolveRequestedUnit, unitsInScope } from "./director-lite-branches";

const ALL = [
  { id: "centro", name: "Centro" },
  { id: "barra", name: "Barra" },
  { id: "nova", name: "Nova Iguaçu" },
];

describe("unidades do painel do diretor", () => {
  it("mostra todas as unidades do tenant para quem tem acesso a todas", () => {
    expect(unitsInScope(ALL, null)).toEqual(ALL);
    expect(unitsInScope(ALL, { canAccessAllUnits: true, allowedUnitIds: [] })).toEqual(ALL);
  });

  it("limita a lista às unidades autorizadas do papel customizado", () => {
    const units = unitsInScope(ALL, { canAccessAllUnits: false, allowedUnitIds: ["centro", "barra"] });
    expect(units.map((unit) => unit.id)).toEqual(["centro", "barra"]);
  });

  it("aceita a unidade pedida só se estiver na lista autorizada", () => {
    const units = [ALL[0]!];
    expect(resolveRequestedUnit("centro", units)).toBe("centro");
    expect(resolveRequestedUnit("nova", units)).toBeNull();
    expect(resolveRequestedUnit("outra-empresa", ALL)).toBeNull();
    expect(resolveRequestedUnit(null, ALL)).toBeNull();
  });
});

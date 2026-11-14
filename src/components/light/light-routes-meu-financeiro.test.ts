import { describe, expect, it } from "vitest";

import { canAccessRoute } from "@/features/custom-roles/effective-access";
import { getRouteDefinition } from "@/features/custom-roles/routes";

import { isLightRouteAllowed, resolveLightRoute } from "./light-routes";

describe("Meu financeiro no Lite", () => {
  it("o corretor pode abrir a rota (a página ainda confere chave, ERP e permissão)", () => {
    expect(isLightRouteAllowed("/meu-financeiro", "broker")).toBe(true);
    expect(isLightRouteAllowed("/meu-financeiro", "supervisor")).toBe(false);
  });

  it("tem título e volta para o Início", () => {
    const route = resolveLightRoute("/meu-financeiro");
    expect(route.title).toBe("Meu financeiro");
    expect(route.parentHref).toBe("/dashboard");
    expect(route.isRoot).toBe(false);
  });

  it("para quem tem cargo, segue a mesma chave da rota de Comissões", () => {
    const definition = getRouteDefinition("/meu-financeiro");
    expect(definition?.key).toBe("erp-comissoes");
    const base = { hasCargo: true, roleCapabilities: new Set(["ver_comissao_propria"] as const), capabilities: new Set(["ver_comissao_propria"] as const) };
    expect(canAccessRoute({ ...base, routes: new Set() }, definition)).toBe(false);
    expect(canAccessRoute({ ...base, routes: new Set(["route:erp-comissoes"]) }, definition)).toBe(true);
  });
});

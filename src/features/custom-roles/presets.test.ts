import { describe, expect, it } from "vitest";

import { hasCapability, type PermissionKey } from "@/shared/auth/permissions";

import { getAssignableCapabilities } from "./catalog";
import { canAccessRoute, resolveEffectiveAccess } from "./effective-access";
import { AREAS_SEM_CORTE_FINO, CARGO_MODELOS, completarAreas } from "./presets";
import { getRouteDefinition, isRoutePermission, routeCatalog, routePermissionKey } from "./routes";

describe("modelos de cargo", () => {
  for (const modelo of CARGO_MODELOS) {
    it(`${modelo.name}: toda chave é atribuível, cabe no papel e leva as áreas inteiras`, () => {
      const assignable = new Set(getAssignableCapabilities(modelo.scope).map((item) => item.key));
      const rotas = new Set(routeCatalog.map((route) => routePermissionKey(route.key)));
      for (const key of modelo.permissions) {
        if (isRoutePermission(key)) {
          expect(rotas.has(key)).toBe(true);
          const rota = routeCatalog.find((route) => routePermissionKey(route.key) === key)!;
          expect(hasCapability(modelo.papel, rota.fallbackPermission, modelo.papel)).toBe(true);
        }
        else {
          expect(assignable.has(key as PermissionKey)).toBe(true);
          expect(hasCapability(modelo.papel, key as PermissionKey, modelo.papel)).toBe(true);
        }
      }
      for (const [rota, permissoes] of Object.entries(AREAS_SEM_CORTE_FINO)) {
        if (modelo.permissions.includes(routePermissionKey(rota))) for (const permission of permissoes) expect(modelo.permissions).toContain(permission);
      }
    });
  }

  it("Plantões abre leads, conversas, equipe, distribuição e plantões, e não abre vendas, relatórios nem configurações", () => {
    const plantoes = CARGO_MODELOS.find((modelo) => modelo.id === "plantoes")!;
    const access = resolveEffectiveAccess({ role: "director", jobTitle: "director", cargo: { status: "active", permissions: plantoes.permissions } });
    for (const path of ["/leads", "/conversas", "/equipe", "/distribuicao", "/leads/distribuicao", "/plantoes", "/minha-fila"]) expect(canAccessRoute(access, getRouteDefinition(path))).toBe(true);
    for (const path of ["/dashboard", "/vendas", "/relatorios", "/settings", "/qualificacao", "/marketing/campanhas", "/filiais", "/negociacoes"]) expect(canAccessRoute(access, getRouteDefinition(path))).toBe(false);
    expect(access.capabilities.has("distribution_settings_manage")).toBe(false);
    expect(access.capabilities.has("convidar_corretor")).toBe(false);
  });

  it("marcar Leads traz as permissões da área inteira", () => {
    expect(completarAreas([routePermissionKey("leads")])).toEqual(expect.arrayContaining(["acessar_leads", "alterar_status_lead", "leads_view_all"]));
  });
});

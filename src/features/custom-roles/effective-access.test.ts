import { describe, expect, it } from "vitest";

import { PERMISSIONS, hasCapability, type PermissionKey } from "@/shared/auth/permissions";

import { canAccessRoute, firstAllowedPath, resolveEffectiveAccess } from "./effective-access";
import { getRouteDefinition, routeCatalog, routePermissionKey } from "./routes";

const PAPEIS = ["director", "manager", "supervisor", "broker"] as const;
const TODAS = Object.keys(PERMISSIONS) as PermissionKey[];

describe("acesso efetivo: papel ∩ cargo", () => {
  it("sem cargo vale exatamente o papel (linha de base de hoje)", () => {
    for (const role of PAPEIS) {
      const access = resolveEffectiveAccess({ role, jobTitle: role, cargo: null });
      expect([...access.capabilities].sort()).toEqual(TODAS.filter((key) => hasCapability(role, key, role)).sort());
    }
  });

  it("cargo nunca amplia o que o papel não tem", () => {
    const cargoComTudo = { status: "active", permissions: TODAS };
    for (const role of PAPEIS) {
      const access = resolveEffectiveAccess({ role, jobTitle: role, cargo: cargoComTudo });
      for (const key of access.capabilities) expect(hasCapability(role, key, role)).toBe(true);
    }
    expect(resolveEffectiveAccess({ role: "manager", jobTitle: "manager", cargo: cargoComTudo }).capabilities.has("leads_view_all")).toBe(false);
  });

  it("cargo corta o que não lista", () => {
    const access = resolveEffectiveAccess({ role: "director", jobTitle: "director", cargo: { status: "active", permissions: ["acessar_leads"] } });
    expect([...access.capabilities]).toEqual(["acessar_leads"]);
  });

  it("cargo que não está ativo não libera nada", () => {
    for (const status of ["draft", "archived", "missing"]) {
      const access = resolveEffectiveAccess({ role: "director", jobTitle: "director", cargo: { status, permissions: TODAS } });
      expect(access.capabilities.size).toBe(0);
      expect(access.routes.size).toBe(0);
    }
  });
});

describe("rotas", () => {
  it("sem cargo: rotas fora do catálogo continuam abertas e as do catálogo seguem o papel", () => {
    const broker = resolveEffectiveAccess({ role: "broker", jobTitle: "broker", cargo: null });
    expect(canAccessRoute(broker, undefined)).toBe(true);
    expect(canAccessRoute(broker, getRouteDefinition("/leads"))).toBe(true);
    expect(canAccessRoute(broker, getRouteDefinition("/distribuicao"))).toBe(false);
    // Rotas novas do catálogo (sem permissão base) não mudam nada para quem não tem cargo.
    expect(canAccessRoute(broker, getRouteDefinition("/plantoes"))).toBe(true);
  });

  it("com cargo: só abre rota com a chave route:*; sem chave nenhuma, nada abre", () => {
    const semRotas = resolveEffectiveAccess({ role: "director", jobTitle: "director", cargo: { status: "active", permissions: ["acessar_leads"] } });
    for (const route of routeCatalog) expect(canAccessRoute(semRotas, getRouteDefinition(route.path))).toBe(false);
    const soLeads = resolveEffectiveAccess({ role: "director", jobTitle: "director", cargo: { status: "active", permissions: ["acessar_leads", routePermissionKey("leads")] } });
    expect(canAccessRoute(soLeads, getRouteDefinition("/leads/123"))).toBe(true);
    expect(canAccessRoute(soLeads, getRouteDefinition("/vendas"))).toBe(false);
  });

  it("com cargo: rota fora do catálogo é negada", () => {
    const access = resolveEffectiveAccess({ role: "director", jobTitle: "director", cargo: { status: "active", permissions: [routePermissionKey("leads")] } });
    expect(canAccessRoute(access, getRouteDefinition("/internal/qualquer"))).toBe(false);
    expect(canAccessRoute(access, getRouteDefinition("/noc"))).toBe(false);
  });

  it("com cargo: o papel continua sendo o piso da rota", () => {
    const broker = resolveEffectiveAccess({ role: "broker", jobTitle: "broker", cargo: { status: "active", permissions: [routePermissionKey("distribuicao")] } });
    expect(canAccessRoute(broker, getRouteDefinition("/distribuicao"))).toBe(false);
  });

  it("primeira tela liberada para quem tem cargo sem o Painel", () => {
    const access = resolveEffectiveAccess({ role: "director", jobTitle: "director", cargo: { status: "active", permissions: [routePermissionKey("conversas"), routePermissionKey("leads")] } });
    expect(firstAllowedPath(access)).toBe("/conversas");
  });

  it("casa pelo prefixo mais longo e pelos apelidos", () => {
    expect(getRouteDefinition("/leads/distribuicao/plantao/1")?.key).toBe("distribuicao");
    expect(getRouteDefinition("/integrations/whatsapp/x")?.key).toBe("whatsapp");
    expect(getRouteDefinition("/integrations/meta")?.key).toBe("integracoes");
    expect(getRouteDefinition("/marketing/campanhas")?.key).toBe("campanhas");
  });
});

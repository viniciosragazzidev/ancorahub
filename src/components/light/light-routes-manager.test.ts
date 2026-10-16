import { describe, expect, it } from "vitest";
import { getLightMoreDestinations, isLightRouteAllowed, LIGHT_MANAGER_ALLOWED_ROUTES } from "./light-routes";

describe("manager Lite routes", () => {
  it("allows only the manager's first Lite destinations and a single lead detail segment", () => {
    for (const path of ["/dashboard", "/leads", "/leads/abc", "/notificacoes", "/settings", "/primeiro-acesso", "/equipe", "/equipe/member-1", "/clientes", "/clientes/client-1", "/empresas", "/unidades/branch-1"]) {
      expect(isLightRouteAllowed(path, "manager"), path).toBe(true);
    }
    for (const path of ["/dashboard/c/ancora", "/leads/dashboard", "/leads/arquivados", "/leads/distribuicao", "/leads/a/b", "/leads/distribuicao/plantao", "/equipe/cargos", "/equipe/convidar", "/equipe/dashboard", "/equipe/recuperacoes", "/equipe/minha", "/equipe/repassar", "/equipe/transferencia", "/equipe/a/b", "/clientes/a/b", "/empresas/abc", "/empresas/abc/leads", "/unidades", "/unidades/branch-1/subpage", "/relatorios", "/cotacao", "/primeiro-acesso/etapa"]) {
      expect(isLightRouteAllowed(path, "manager"), path).toBe(false);
    }
    expect(LIGHT_MANAGER_ALLOWED_ROUTES).toHaveLength(18);
    expect(isLightRouteAllowed("/gestao", "manager")).toBe(true);
    expect(isLightRouteAllowed("/gestao/a/b", "manager")).toBe(false);
    expect(isLightRouteAllowed("/mensagens", "manager")).toBe(true);
    expect(isLightRouteAllowed("/mensagens/lead-1", "manager")).toBe(true);
    expect(isLightRouteAllowed("/mensagens/a/b", "manager")).toBe(false);
    expect(isLightRouteAllowed("/empresas", "manager")).toBe(true);
  });

  it("shows unit leads, team, clients, companies, notifications and settings in Mais", () => {
    expect(getLightMoreDestinations({ quoteSimulator: true, dutyCalendar: true, relationshipCenter: true }, "manager").map((item) => item.href))
      .toEqual(["/leads", "/equipe", "/clientes", "/mensagens", "/empresas", "/notificacoes", "/settings"]);
  });
});

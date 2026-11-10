import { describe, expect, it } from "vitest";
import { canShowNavigationItem } from "./navigation-access";

describe("acesso a itens de navegação e busca", () => {
  const leads = { url: "/leads", permission: "acessar_leads" as const };

  it("exige a permissão efetiva do usuário", () => {
    expect(canShowNavigationItem(leads, { roleKey: "supervisor", jobTitle: "supervisor", permissions: ["acessar_leads"] })).toBe(true);
    expect(canShowNavigationItem(leads, { roleKey: "supervisor", jobTitle: "supervisor", permissions: [] })).toBe(false);
  });

  it("respeita as restrições de caminho da navegação por papel", () => {
    expect(canShowNavigationItem({ url: "/cotacao", permission: "acessar_cotacoes" }, { roleKey: "broker", jobTitle: "broker", permissions: ["acessar_cotacoes"] })).toBe(false);
    expect(canShowNavigationItem({ url: "/marketing/campanhas", permission: "acessar_campanhas_meta" }, { roleKey: "manager", jobTitle: "manager", permissions: ["acessar_campanhas_meta"] })).toBe(false);
  });

  it("gestor de unidade só vê as rotas da gestão da unidade (10/11)", () => {
    const gestor = { roleKey: "manager" as const, jobTitle: "manager", permissions: ["acessar_leads", "convidar_corretor", "acessar_dashboard"] };
    expect(canShowNavigationItem(leads, gestor)).toBe(false);
    expect(canShowNavigationItem({ url: "/equipe", permission: "convidar_corretor" }, gestor)).toBe(true);
    expect(canShowNavigationItem({ url: "/dashboard", permission: "acessar_dashboard" }, gestor)).toBe(true);
    expect(canShowNavigationItem(leads, { ...gestor, jobTitle: "marketing" })).toBe(true);
  });

  it("usa a permissão explícita de rota quando ela existe", () => {
    expect(canShowNavigationItem(leads, { roleKey: "supervisor", jobTitle: "supervisor", permissions: ["route:leads"] })).toBe(true);
    expect(canShowNavigationItem(leads, { roleKey: "supervisor", jobTitle: "supervisor", permissions: ["route:dashboard"] })).toBe(false);
  });
});

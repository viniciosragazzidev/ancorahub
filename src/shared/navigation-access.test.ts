import { describe, expect, it } from "vitest";
import { canShowNavigationItem } from "./navigation-access";

describe("acesso a itens de navegação e busca", () => {
  const leads = { url: "/leads", permission: "acessar_leads" as const };

  it("exige a permissão efetiva do usuário", () => {
    expect(canShowNavigationItem(leads, { roleKey: "manager", jobTitle: "manager", permissions: ["acessar_leads"] })).toBe(true);
    expect(canShowNavigationItem(leads, { roleKey: "manager", jobTitle: "manager", permissions: [] })).toBe(false);
  });

  it("respeita as restrições de caminho da navegação por papel", () => {
    expect(canShowNavigationItem({ url: "/cotacao", permission: "acessar_cotacoes" }, { roleKey: "broker", jobTitle: "broker", permissions: ["acessar_cotacoes"] })).toBe(false);
    expect(canShowNavigationItem({ url: "/marketing/campanhas", permission: "acessar_campanhas_meta" }, { roleKey: "manager", jobTitle: "manager", permissions: ["acessar_campanhas_meta"] })).toBe(false);
  });

  it("usa a permissão explícita de rota quando ela existe", () => {
    expect(canShowNavigationItem(leads, { roleKey: "manager", jobTitle: "manager", permissions: ["route:leads"] })).toBe(true);
    expect(canShowNavigationItem(leads, { roleKey: "manager", jobTitle: "manager", permissions: ["route:dashboard"] })).toBe(false);
  });
});

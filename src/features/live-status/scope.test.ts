import { describe, expect, it } from "vitest";

import type { TenantContext } from "@/shared/auth/types";

import { resolveLiveScope } from "./scope";
import { canSeeDistributionEngineSeal, visibleStatusIds } from "./visibility";

const context = (overrides: Partial<TenantContext>): TenantContext => ({ userId: "u1", tenantId: "t1", role: "director", jobTitle: "director", branchId: null, ...overrides });

describe("escopo do status vivo", () => {
  it("chave de cache por escopo, nunca o objeto de sessão", () => {
    expect(resolveLiveScope(context({}))?.key).toBe("t1:all");
    expect(resolveLiveScope(context({ role: "manager", jobTitle: "manager", branchId: "b1" }))?.key).toBe("t1:branch:b1");
    expect(resolveLiveScope(context({ role: "supervisor", jobTitle: "supervisor" }))?.key).toBe("t1:supervisor:u1");
    expect(resolveLiveScope(context({ role: "broker", jobTitle: "broker" }))?.key).toBe("t1:broker:u1");
  });

  it("gestor sem unidade e marketing não têm operação para ver", () => {
    expect(resolveLiveScope(context({ role: "manager", jobTitle: "manager", branchId: null }))).toBeNull();
    expect(resolveLiveScope(context({ role: "manager", jobTitle: "marketing", branchId: "b1" }))).toBeNull();
  });

  it("a Qualificação só aparece como link para quem já abre a tela", () => {
    expect(resolveLiveScope(context({}))?.canOpenQualification).toBe(true);
    expect(resolveLiveScope(context({ role: "broker", jobTitle: "broker" }))?.canOpenQualification).toBe(false);
  });
});

describe("quem vê o quê", () => {
  it("diretor e gestor: os status da operação e o selo", () => {
    expect(visibleStatusIds("director")).toHaveLength(9);
    expect(visibleStatusIds("manager")).toHaveLength(9);
    expect(visibleStatusIds("director")).toContain("duty-reminders");
    expect(canSeeDistributionEngineSeal("director")).toBe(true);
    expect(canSeeDistributionEngineSeal("manager")).toBe(true);
  });

  it("supervisor e corretor: só ofertas, primeiro contato e plantão; sem selo nem fila do WhatsApp", () => {
    expect(visibleStatusIds("supervisor")).toEqual(["ofertas", "primeiro-contato", "plantao"]);
    expect(visibleStatusIds("broker")).toEqual(["ofertas", "primeiro-contato", "plantao"]);
    expect(canSeeDistributionEngineSeal("supervisor")).toBe(false);
    expect(canSeeDistributionEngineSeal("broker")).toBe(false);
  });
});

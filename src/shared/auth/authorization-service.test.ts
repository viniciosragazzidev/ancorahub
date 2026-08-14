import { describe, expect, it } from "vitest";
import { AuthorizationService } from "./authorization-service";
import type { AccessContext } from "./access-context";
import { AuthorizationError } from "./errors";
import { schema } from "@/shared/db";

describe("AuthorizationService", () => {
  const directorContext: AccessContext = {
    userId: "dir-1",
    tenantId: "tenant-a",
    role: "director",
    jobTitle: "director",
    branchId: null,
    permissions: new Set(["acessar_leads", "leads_view_all", "acessar_financeiro"]),
    scopeType: "GLOBAL",
    allowedUnitIds: [],
    canAccessAllUnits: true,
  };

  const managerSpContext: AccessContext = {
    userId: "mgr-sp",
    tenantId: "tenant-a",
    role: "manager",
    jobTitle: "manager",
    branchId: "branch-sp",
    permissions: new Set(["acessar_leads", "criar_lead_manual"]),
    scopeType: "UNITS",
    allowedUnitIds: ["branch-sp"],
    canAccessAllUnits: false,
  };

  const brokerContext: AccessContext = {
    userId: "broker-1",
    tenantId: "tenant-a",
    role: "broker",
    jobTitle: "broker",
    branchId: "branch-sp",
    permissions: new Set(["acessar_leads"]),
    scopeType: "SELF",
    allowedUnitIds: ["branch-sp"],
    canAccessAllUnits: false,
  };

  describe("can & requirePermission", () => {
    it("permite ação quando o usuário possui a permissão", () => {
      expect(AuthorizationService.can(managerSpContext, "acessar_leads")).toBe(true);
      expect(() => AuthorizationService.requirePermission(managerSpContext, "acessar_leads")).not.toThrow();
    });

    it("rejeita ação quando o usuário não possui a permissão", () => {
      expect(AuthorizationService.can(managerSpContext, "acessar_financeiro")).toBe(false);
      expect(() => AuthorizationService.requirePermission(managerSpContext, "acessar_financeiro")).toThrow(AuthorizationError);
    });
  });

  describe("canAccessUnit", () => {
    it("Diretor possui acesso global a todas as unidades do tenant", () => {
      expect(AuthorizationService.canAccessUnit(directorContext, "branch-sp")).toBe(true);
      expect(AuthorizationService.canAccessUnit(directorContext, "branch-rj")).toBe(true);
    });

    it("Gestor SP acessa somente a filial SP e bloqueia RJ", () => {
      expect(AuthorizationService.canAccessUnit(managerSpContext, "branch-sp")).toBe(true);
      expect(AuthorizationService.canAccessUnit(managerSpContext, "branch-rj")).toBe(false);
    });
  });

  describe("intersectUnitScope (Regra de Ouro)", () => {
    it("não amplia o escopo se o frontend solicitar unidades fora da autorização", () => {
      const requested = ["branch-sp", "branch-rj"];
      const effective = AuthorizationService.intersectUnitScope(managerSpContext, requested);
      expect(effective).toEqual(["branch-sp"]);
    });

    it("Diretor pode acessar todas as unidades solicitadas", () => {
      const requested = ["branch-sp", "branch-rj"];
      const effective = AuthorizationService.intersectUnitScope(directorContext, requested);
      expect(effective).toEqual(["branch-sp", "branch-rj"]);
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { AuthorizationService } from "./authorization-service";
import type { AccessContext } from "./access-context";
import type { PermissionKey } from "./permissions";
import { evaluateShadowAuthorization, isAuthShadowModeEnabled } from "./shadow-mode";
import { canManageMember } from "./team-permissions";

function createMockAccessContext(overrides: Partial<AccessContext> = {}): AccessContext {
  const role = overrides.role ?? "director";
  const isDirector = role === "director";
  const isBroker = role === "broker";
  const isManager = role === "manager";

  const allowedUnitIds = overrides.allowedUnitIds ?? (isManager ? ["unit-a", "unit-b"] : isBroker ? ["unit-a"] : []);
  const canAccessAllUnits = overrides.canAccessAllUnits ?? isDirector;
  const scopeType = overrides.scopeType ?? (isDirector ? "GLOBAL" : isBroker ? "SELF" : "UNITS");

  return {
    userId: "user-1",
    tenantId: "tenant-anchor",
    role,
    jobTitle: "diretor",
    customRoleId: null,
    customRoleScope: null,
    branchId: "unit-a",
    permissions: new Set<PermissionKey>([
      "acessar_leads",
      "ver_perfil_unidade",
      "gerenciar_configuracoes_unidade",
      "convidar_corretor",
      "configurar_whatsapp_proprio",
    ]),
    scope: {
      tenantWide: canAccessAllUnits,
      unitIds: allowedUnitIds,
      teamIds: [],
      ownership: isDirector ? "ANY" : isBroker ? "SELF" : "SCOPED",
      provenance: {
        units: isDirector ? "TENANT_WIDE" : "TENANT_MANAGER_BRANCHES",
      },
    },
    scopeType,
    allowedUnitIds,
    canAccessAllUnits,
    ...overrides,
  };
}

describe("Canonical Authorization & Security Matrix (Phase 1A)", () => {
  describe("1. Tenant Isolation (Absolute Invariant - ROOT_ONLY)", () => {
    it("DIRECTOR: allows access to any unit within the same tenant", () => {
      const context = createMockAccessContext({ role: "director" });
      const decision = AuthorizationService.evaluate(context, "ver_perfil_unidade", {
        tenantId: "tenant-anchor",
        unitId: "unit-any-internal",
      });

      expect(decision.allowed).toBe(true);
      expect(decision.matchedScope).toBe("TENANT_WIDE");
    });

    it("DIRECTOR: strictly DENIES access to a resource belonging to another tenant (Cross-Tenant Isolation)", () => {
      const context = createMockAccessContext({ role: "director" });
      const decision = AuthorizationService.evaluate(context, "ver_perfil_unidade", {
        tenantId: "tenant-competitor",
        unitId: "unit-any",
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("TENANT_MISMATCH");
    });

    it("MANAGER: strictly DENIES access to another tenant even if unit ID matches", () => {
      const context = createMockAccessContext({
        role: "manager",
        allowedUnitIds: ["unit-a"],
      });
      const decision = AuthorizationService.evaluate(context, "gerenciar_configuracoes_unidade", {
        tenantId: "tenant-other",
        unitId: "unit-a",
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("TENANT_MISMATCH");
    });
  });

  describe("2. Multi-Unit Manager Scope", () => {
    it("MANAGER: allows access to authorized units A and B, but DENIES unit C (IDOR Protection)", () => {
      const context = createMockAccessContext({
        role: "manager",
        allowedUnitIds: ["unit-a", "unit-b"],
        scope: {
          tenantWide: false,
          unitIds: ["unit-a", "unit-b"],
          teamIds: [],
          ownership: "SCOPED",
          provenance: { units: "TENANT_MANAGER_BRANCHES" },
        },
        scopeType: "UNITS",
        canAccessAllUnits: false,
      });

      // Unit A -> ALLOW
      const decisionA = AuthorizationService.evaluate(context, "gerenciar_configuracoes_unidade", {
        tenantId: "tenant-anchor",
        unitId: "unit-a",
      });
      expect(decisionA.allowed).toBe(true);
      expect(decisionA.matchedScope).toBe("UNIT");

      // Unit B -> ALLOW
      const decisionB = AuthorizationService.evaluate(context, "gerenciar_configuracoes_unidade", {
        tenantId: "tenant-anchor",
        unitId: "unit-b",
      });
      expect(decisionB.allowed).toBe(true);
      expect(decisionB.matchedScope).toBe("UNIT");

      // Unit C (not linked) -> DENY (IDOR prevention)
      const decisionC = AuthorizationService.evaluate(context, "gerenciar_configuracoes_unidade", {
        tenantId: "tenant-anchor",
        unitId: "unit-c",
      });
      expect(decisionC.allowed).toBe(false);
      expect(decisionC.reason).toBe("UNIT_OUT_OF_SCOPE");
    });

    it("canAccessUnit helper accurately evaluates multi-unit managers", () => {
      const context = createMockAccessContext({
        role: "manager",
        allowedUnitIds: ["unit-1", "unit-2"],
        scope: {
          tenantWide: false,
          unitIds: ["unit-1", "unit-2"],
          teamIds: [],
          ownership: "SCOPED",
          provenance: { units: "TENANT_MANAGER_BRANCHES" },
        },
      });

      expect(AuthorizationService.canAccessUnit(context, "unit-1")).toBe(true);
      expect(AuthorizationService.canAccessUnit(context, "unit-2")).toBe(true);
      expect(AuthorizationService.canAccessUnit(context, "unit-3")).toBe(false);
      expect(AuthorizationService.canAccessUnit(context, null)).toBe(false);
    });
  });

  describe("3. Broker Self-Ownership", () => {
    it("BROKER: allows access to own resource when capability is present", () => {
      const context = createMockAccessContext({
        role: "broker",
        userId: "broker-42",
        scope: {
          tenantWide: false,
          unitIds: ["unit-a"],
          teamIds: [],
          ownership: "SELF",
          provenance: { units: "SELF_BROKER" },
        },
        scopeType: "SELF",
        canAccessAllUnits: false,
      });

      const decision = AuthorizationService.evaluate(context, "configurar_whatsapp_proprio", {
        tenantId: "tenant-anchor",
        ownerUserId: "broker-42",
      });

      expect(decision.allowed).toBe(true);
      expect(decision.matchedScope).toBe("SELF");
    });

    it("BROKER: DENIES access to another broker's resource (IDOR Protection)", () => {
      const context = createMockAccessContext({
        role: "broker",
        userId: "broker-42",
        scope: {
          tenantWide: false,
          unitIds: ["unit-a"],
          teamIds: [],
          ownership: "SELF",
          provenance: { units: "SELF_BROKER" },
        },
        scopeType: "SELF",
      });

      const decision = AuthorizationService.evaluate(context, "configurar_whatsapp_proprio", {
        tenantId: "tenant-anchor",
        ownerUserId: "broker-99", // Victim broker
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("NOT_RESOURCE_OWNER");
    });
  });

  describe("4. Capability vs Scope Independence", () => {
    it("DENIES when capability is missing even if unit scope is perfectly matching", () => {
      const context = createMockAccessContext({
        role: "manager",
        permissions: new Set<PermissionKey>(["acessar_leads"]), // lacks "gerenciar_financeiro"
      });

      const decision = AuthorizationService.evaluate(context, "gerenciar_financeiro", {
        tenantId: "tenant-anchor",
        unitId: "unit-a",
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("MISSING_CAPABILITY");
    });

    it("DENIES when capability is present but unit is out of scope", () => {
      const context = createMockAccessContext({
        role: "manager",
        permissions: new Set<PermissionKey>(["gerenciar_configuracoes_unidade"]),
        allowedUnitIds: ["unit-a"],
        scope: {
          tenantWide: false,
          unitIds: ["unit-a"],
          teamIds: [],
          ownership: "SCOPED",
          provenance: { units: "LEGACY_MEMBERSHIP_BRANCH" },
        },
      });

      const decision = AuthorizationService.evaluate(context, "gerenciar_configuracoes_unidade", {
        tenantId: "tenant-anchor",
        unitId: "unit-forbidden",
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("UNIT_OUT_OF_SCOPE");
    });
  });

  describe("5. Empty Scope & Fail Closed", () => {
    it("DENIES when user scope is empty or inactive (Fail-Closed Invariant)", () => {
      const context = createMockAccessContext({
        role: "manager",
        allowedUnitIds: [],
        scope: {
          tenantWide: false,
          unitIds: [],
          teamIds: [],
          ownership: "NONE",
          provenance: { units: "EMPTY_FALLBACK" },
        },
        scopeType: "NONE",
      });

      const decision = AuthorizationService.evaluate(context, "ver_perfil_unidade", {
        tenantId: "tenant-anchor",
        unitId: "unit-a",
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("SCOPE_EMPTY");
    });
  });

  describe("6. Custom Roles Scope Handling", () => {
    it("CUSTOM ROLE with tenant scope allows tenant-wide operations", () => {
      const context = createMockAccessContext({
        role: "broker",
        customRoleId: "custom-marketing",
        customRoleScope: "tenant",
        permissions: new Set<PermissionKey>(["ver_importacoes_meta", "acessar_campanhas_meta"]),
        scope: {
          tenantWide: true,
          unitIds: [],
          teamIds: [],
          ownership: "ANY",
          provenance: { units: "CUSTOM_ROLE_SCOPE" },
        },
        canAccessAllUnits: true,
        scopeType: "GLOBAL",
      });

      const decision = AuthorizationService.evaluate(context, "ver_importacoes_meta", {
        tenantId: "tenant-anchor",
        unitId: "unit-xyz",
      });

      expect(decision.allowed).toBe(true);
      expect(decision.matchedScope).toBe("TENANT_WIDE");
    });

    it("CUSTOM ROLE with branch scope restricts to authorized unit", () => {
      const context = createMockAccessContext({
        role: "broker",
        customRoleId: "custom-supervisor",
        customRoleScope: "branch",
        permissions: new Set<PermissionKey>(["acessar_leads"]),
        allowedUnitIds: ["unit-alpha"],
        scope: {
          tenantWide: false,
          unitIds: ["unit-alpha"],
          teamIds: [],
          ownership: "SCOPED",
          provenance: { units: "CUSTOM_ROLE_SCOPE" },
        },
        scopeType: "UNITS",
        canAccessAllUnits: false,
      });

      const allowed = AuthorizationService.can(context, "acessar_leads", {
        tenantId: "tenant-anchor",
        unitId: "unit-alpha",
      });
      const denied = AuthorizationService.can(context, "acessar_leads", {
        tenantId: "tenant-anchor",
        unitId: "unit-beta",
      });

      expect(allowed).toBe(true);
      expect(denied).toBe(false);
    });
  });

  describe("7. Query Scope Constraints Adapter", () => {
    it("returns pure query filtering constraints for Director", () => {
      const context = createMockAccessContext({ role: "director" });
      const constraints = AuthorizationService.getQueryScopeConstraints(context);

      expect(constraints.tenantId).toBe("tenant-anchor");
      expect(constraints.tenantWide).toBe(true);
      expect(constraints.ownerMode).toBe("ANY");
    });

    it("returns pure query filtering constraints for Multi-Unit Manager", () => {
      const context = createMockAccessContext({
        role: "manager",
        allowedUnitIds: ["unit-1", "unit-2"],
        scope: {
          tenantWide: false,
          unitIds: ["unit-1", "unit-2"],
          teamIds: [],
          ownership: "SCOPED",
          provenance: { units: "TENANT_MANAGER_BRANCHES" },
        },
        scopeType: "UNITS",
      });
      const constraints = AuthorizationService.getQueryScopeConstraints(context);

      expect(constraints.tenantId).toBe("tenant-anchor");
      expect(constraints.tenantWide).toBe(false);
      expect(constraints.allowedUnitIds).toEqual(["unit-1", "unit-2"]);
      expect(constraints.ownerMode).toBe("SCOPED");
    });

    it("returns pure query filtering constraints for Broker", () => {
      const context = createMockAccessContext({
        role: "broker",
        userId: "broker-7",
        scope: {
          tenantWide: false,
          unitIds: ["unit-1"],
          teamIds: [],
          ownership: "SELF",
          provenance: { units: "SELF_BROKER" },
        },
        scopeType: "SELF",
      });
      const constraints = AuthorizationService.getQueryScopeConstraints(context);

      expect(constraints.tenantId).toBe("tenant-anchor");
      expect(constraints.tenantWide).toBe(false);
      expect(constraints.ownerMode).toBe("SELF");
      expect(constraints.effectiveOwnerUserId).toBe("broker-7");
    });
  });

  describe("8. Multi-Unit Team Member Management", () => {
    it("canManageMember allows multi-unit manager to manage brokers across all authorized units", () => {
      const context = createMockAccessContext({
        userId: "manager-1",
        role: "manager",
        allowedUnitIds: ["unit-a", "unit-b"],
        scope: {
          tenantWide: false,
          unitIds: ["unit-a", "unit-b"],
          teamIds: [],
          ownership: "SCOPED",
          provenance: { units: "TENANT_MANAGER_BRANCHES" },
        },
      });

      // Target in Unit A -> ALLOW
      expect(
        canManageMember(context, {
          userId: "broker-a",
          role: "broker",
          branchId: "unit-a",
        }),
      ).toBe(true);

      // Target in Unit B -> ALLOW
      expect(
        canManageMember(context, {
          userId: "broker-b",
          role: "broker",
          branchId: "unit-b",
        }),
      ).toBe(true);

      // Target in Unit C (outside scope) -> DENY
      expect(
        canManageMember(context, {
          userId: "broker-c",
          role: "broker",
          branchId: "unit-c",
        }),
      ).toBe(false);

      // Cannot manage self or directors
      expect(
        canManageMember(context, {
          userId: "manager-1",
          role: "manager",
          branchId: "unit-a",
        }),
      ).toBe(false);
      expect(
        canManageMember(context, {
          userId: "director-1",
          role: "director",
          branchId: "unit-a",
        }),
      ).toBe(false);
    });
  });

  describe("9. Shadow Mode Evaluation & Safe Telemetry", () => {
    it("emits non-PII log on mismatch when shadow mode is enabled", async () => {
      process.env.AUTH_SHADOW_MODE = "true";
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const context = createMockAccessContext({
        role: "manager",
        allowedUnitIds: ["unit-a", "unit-b"],
        branchId: "unit-a", // legacy single branch
        scope: {
          tenantWide: false,
          unitIds: ["unit-a", "unit-b"],
          teamIds: [],
          ownership: "SCOPED",
          provenance: { units: "TENANT_MANAGER_BRANCHES" },
        },
      });

      // Simulating a legacy check that only looked at context.branchId (unit-a)
      // and denied unit-b, while canonical multi-unit allows unit-b:
      const result = await evaluateShadowAuthorization({
        operationKey: "branches.assertBranchProfileAccess",
        legacyAllowed: false,
        context,
        capability: "ver_perfil_unidade",
        resource: {
          tenantId: "tenant-anchor",
          unitId: "unit-b",
        },
      });

      expect(result.mismatch).toBe(true);
      expect(result.legacyAllowed).toBe(false);
      expect(result.canonicalDecision.allowed).toBe(true);

      expect(warnSpy).toHaveBeenCalled();
      const loggedData = JSON.parse(warnSpy.mock.calls[0][0]);
      expect(loggedData.event).toBe("auth_shadow_mismatch");
      expect(loggedData.operation).toBe("branches.assertBranchProfileAccess");
      expect(loggedData.legacyAllowed).toBe(false);
      expect(loggedData.canonicalAllowed).toBe(true);
      // No PII or secrets
      expect(loggedData.password).toBeUndefined();
      expect(loggedData.token).toBeUndefined();

      delete process.env.AUTH_SHADOW_MODE;
      warnSpy.mockRestore();
    });
  });
});

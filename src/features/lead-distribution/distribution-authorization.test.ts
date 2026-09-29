import { describe, expect, it } from "vitest";
import { AuthorizationService } from "@/shared/auth/authorization-service";
import type { AccessContext } from "@/shared/auth/access-context";

describe("Distribution Authorization & Scope Readiness", () => {
  const tenantA = "11111111-1111-1111-1111-111111111111";
  const tenantB = "22222222-2222-2222-2222-222222222222";
  const unitA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const unitB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const unitC = "cccccccc-cccc-cccc-cccc-cccccccccccc";

  const directorContext: AccessContext = {
    tenantId: tenantA,
    userId: "director-1",
    role: "director",
    jobTitle: "director",
    branchId: null,
    allowedUnitIds: [unitA, unitB, unitC],
    canAccessAllUnits: true,
    customRoleId: null,
    scopeType: "GLOBAL",
    scope: {
      tenantWide: true,
      unitIds: [unitA, unitB, unitC],
      teamIds: [],
      ownership: "ANY",
      provenance: { units: "TENANT_WIDE" },
    },
    permissions: new Set([
      "distribution_settings_manage",
      "lead_queues_manage",
      "lead_queues_view",
      "leads_reassign",
      "leads_bulk_assign",
    ]),
  };

  const managerContextUnitA: AccessContext = {
    tenantId: tenantA,
    userId: "manager-1",
    role: "manager",
    jobTitle: "manager",
    branchId: unitA,
    allowedUnitIds: [unitA],
    canAccessAllUnits: false,
    customRoleId: null,
    scopeType: "UNITS",
    scope: {
      tenantWide: false,
      unitIds: [unitA],
      teamIds: [],
      ownership: "SCOPED",
      provenance: { units: "LEGACY_MEMBERSHIP_BRANCH" },
    },
    permissions: new Set([
      "lead_queues_manage",
      "lead_queues_view",
      "leads_reassign",
      "leads_bulk_assign",
    ]),
  };

  const managerContextMultiUnitAB: AccessContext = {
    tenantId: tenantA,
    userId: "manager-multi",
    role: "manager",
    jobTitle: "manager",
    branchId: unitA,
    allowedUnitIds: [unitA, unitB],
    canAccessAllUnits: false,
    customRoleId: null,
    scopeType: "UNITS",
    scope: {
      tenantWide: false,
      unitIds: [unitA, unitB],
      teamIds: [],
      ownership: "SCOPED",
      provenance: { units: "TENANT_MANAGER_BRANCHES" },
    },
    permissions: new Set([
      "lead_queues_manage",
      "lead_queues_view",
      "leads_reassign",
      "leads_bulk_assign",
    ]),
  };

  const brokerContext: AccessContext = {
    tenantId: tenantA,
    userId: "broker-1",
    role: "broker",
    jobTitle: "broker",
    branchId: unitA,
    allowedUnitIds: [unitA],
    canAccessAllUnits: false,
    customRoleId: null,
    scopeType: "SELF",
    scope: {
      tenantWide: false,
      unitIds: [unitA],
      teamIds: [],
      ownership: "SELF",
      provenance: { units: "SELF_BROKER" },
    },
    permissions: new Set(["acessar_leads"]),
  };

  describe("Distribution Settings & Policy Authorization", () => {
    it("Director has authority to manage distribution policies", () => {
      const allowed = AuthorizationService.can(directorContext, "distribution_settings_manage", {
        tenantId: tenantA,
        unitId: null,
        teamId: null,
        ownerUserId: null,
      });
      expect(allowed).toBe(true);
    });

    it("Broker cannot manage distribution policies", () => {
      const allowed = AuthorizationService.can(brokerContext, "distribution_settings_manage", {
        tenantId: tenantA,
        unitId: null,
        teamId: null,
        ownerUserId: null,
      });
      expect(allowed).toBe(false);
    });

    it("Cross-tenant policy management is denied even for Director", () => {
      const allowed = AuthorizationService.can(directorContext, "distribution_settings_manage", {
        tenantId: tenantB,
        unitId: null,
        teamId: null,
        ownerUserId: null,
      });
      expect(allowed).toBe(false);
    });
  });

  describe("Lead Queue Scope Management", () => {
    it("Director can manage any queue within tenant", () => {
      const queueTenant = { tenantId: tenantA, unitId: null, teamId: null, ownerUserId: null };
      const queueUnitA = { tenantId: tenantA, unitId: unitA, teamId: null, ownerUserId: null };
      const queueUnitB = { tenantId: tenantA, unitId: unitB, teamId: null, ownerUserId: null };

      expect(AuthorizationService.can(directorContext, "lead_queues_manage", queueTenant)).toBe(true);
      expect(AuthorizationService.can(directorContext, "lead_queues_manage", queueUnitA)).toBe(true);
      expect(AuthorizationService.can(directorContext, "lead_queues_manage", queueUnitB)).toBe(true);
    });

    it("Manager Unit A can manage queues for Unit A, but not Unit B or Global queue", () => {
      const queueUnitA = { tenantId: tenantA, unitId: unitA, teamId: null, ownerUserId: null };
      const queueUnitB = { tenantId: tenantA, unitId: unitB, teamId: null, ownerUserId: null };
      const queueGlobal = { tenantId: tenantA, unitId: null, teamId: null, ownerUserId: null };

      expect(AuthorizationService.can(managerContextUnitA, "lead_queues_manage", queueUnitA)).toBe(true);
      expect(AuthorizationService.can(managerContextUnitA, "lead_queues_manage", queueUnitB)).toBe(false);
      expect(AuthorizationService.can(managerContextUnitA, "lead_queues_manage", queueGlobal)).toBe(false);
    });

    it("Multi-Unit Manager (A+B) can manage queues for Unit A and Unit B, but not Unit C", () => {
      const queueUnitA = { tenantId: tenantA, unitId: unitA, teamId: null, ownerUserId: null };
      const queueUnitB = { tenantId: tenantA, unitId: unitB, teamId: null, ownerUserId: null };
      const queueUnitC = { tenantId: tenantA, unitId: unitC, teamId: null, ownerUserId: null };

      expect(AuthorizationService.can(managerContextMultiUnitAB, "lead_queues_manage", queueUnitA)).toBe(true);
      expect(AuthorizationService.can(managerContextMultiUnitAB, "lead_queues_manage", queueUnitB)).toBe(true);
      expect(AuthorizationService.can(managerContextMultiUnitAB, "lead_queues_manage", queueUnitC)).toBe(false);
    });
  });

  describe("Manual Reassignment Target Authorization", () => {
    it("Manager Unit A can reassign lead from Unit A", () => {
      const leadUnitA = { tenantId: tenantA, unitId: unitA, teamId: null, ownerUserId: "broker-1" };
      expect(AuthorizationService.can(managerContextUnitA, "leads_reassign", leadUnitA)).toBe(true);
    });

    it("Manager Unit A cannot reassign lead from Unit B", () => {
      const leadUnitB = { tenantId: tenantA, unitId: unitB, teamId: null, ownerUserId: "broker-2" };
      expect(AuthorizationService.can(managerContextUnitA, "leads_reassign", leadUnitB)).toBe(false);
    });

    it("Broker cannot manually reassign leads", () => {
      const leadUnitA = { tenantId: tenantA, unitId: unitA, teamId: null, ownerUserId: "broker-1" };
      expect(AuthorizationService.can(brokerContext, "leads_reassign", leadUnitA)).toBe(false);
    });
  });
});

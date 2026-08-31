import { describe, expect, it } from "vitest";
import {
  canCreateRole,
  canManageMember,
  requireCanUpdateMemberAuthority,
} from "@/shared/auth/team-permissions";
import { AuthorizationError } from "@/shared/auth/errors";
import type { AccessContext } from "@/shared/auth/access-context";

describe("Team Authorization & Privilege Escalation Hardening", () => {
  const tenantA = "11111111-1111-1111-1111-111111111111";
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
    permissions: new Set(["gerenciar_filiais", "convidar_gestor", "ver_dashboard_equipe"]),
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
    permissions: new Set(["ver_dashboard_equipe", "convidar_corretor"]),
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
    permissions: new Set(["ver_dashboard_equipe", "convidar_corretor"]),
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

  describe("canCreateRole & requireCanCreateRole", () => {
    it("Director can create any role (director, manager, supervisor, broker)", () => {
      expect(canCreateRole("director", "director")).toBe(true);
      expect(canCreateRole("director", "manager")).toBe(true);
      expect(canCreateRole("director", "supervisor")).toBe(true);
      expect(canCreateRole("director", "broker")).toBe(true);
    });

    it("Manager can only create supervisor or broker, not director or manager", () => {
      expect(canCreateRole("manager", "director")).toBe(false);
      expect(canCreateRole("manager", "manager")).toBe(false);
      expect(canCreateRole("manager", "supervisor")).toBe(true);
      expect(canCreateRole("manager", "broker")).toBe(true);
    });

    it("Supervisor can only create broker", () => {
      expect(canCreateRole("supervisor", "director")).toBe(false);
      expect(canCreateRole("supervisor", "manager")).toBe(false);
      expect(canCreateRole("supervisor", "supervisor")).toBe(false);
      expect(canCreateRole("supervisor", "broker")).toBe(true);
    });

    it("Broker cannot create any role", () => {
      expect(canCreateRole("broker", "broker")).toBe(false);
      expect(canCreateRole("broker", "director")).toBe(false);
    });
  });

  describe("canManageMember & requireCanManageMember", () => {
    it("Manager cannot manage another Manager or Director", () => {
      expect(
        canManageMember(managerContextUnitA, {
          userId: "other-manager",
          role: "manager",
          branchId: unitA,
        }),
      ).toBe(false);

      expect(
        canManageMember(managerContextUnitA, {
          userId: "director-1",
          role: "director",
          branchId: null,
        }),
      ).toBe(false);
    });

    it("Manager can manage Broker in their authorized unit", () => {
      expect(
        canManageMember(managerContextUnitA, {
          userId: "broker-in-unit-a",
          role: "broker",
          branchId: unitA,
        }),
      ).toBe(true);
    });

    it("Manager Unit A CANNOT manage Broker in Unit B or Unit C", () => {
      expect(
        canManageMember(managerContextUnitA, {
          userId: "broker-in-unit-b",
          role: "broker",
          branchId: unitB,
        }),
      ).toBe(false);
    });

    it("Multi-Unit Manager (A+B) CAN manage Broker in Unit B, but CANNOT in Unit C", () => {
      expect(
        canManageMember(managerContextMultiUnitAB, {
          userId: "broker-in-unit-b",
          role: "broker",
          branchId: unitB,
        }),
      ).toBe(true);

      expect(
        canManageMember(managerContextMultiUnitAB, {
          userId: "broker-in-unit-c",
          role: "broker",
          branchId: unitC,
        }),
      ).toBe(false);
    });

    it("User cannot manage themselves (prevents self-privilege modification)", () => {
      expect(
        canManageMember(managerContextUnitA, {
          userId: managerContextUnitA.userId,
          role: "manager",
          branchId: unitA,
        }),
      ).toBe(false);
    });
  });

  describe("requireCanUpdateMemberAuthority (Privilege & Scope Escalation Protection)", () => {
    it("prevents Manager from promoting a Broker to Director (Privilege Escalation)", () => {
      expect(() => {
        requireCanUpdateMemberAuthority({
          actorContext: managerContextUnitA,
          targetMember: {
            userId: "broker-1",
            role: "broker",
            branchId: unitA,
          },
          proposed: {
            role: "director",
            branchId: unitA,
          },
        });
      }).toThrow(AuthorizationError);
    });

    it("prevents Manager Unit A from moving a Broker to Unit B outside manager scope (Scope Escalation)", () => {
      expect(() => {
        requireCanUpdateMemberAuthority({
          actorContext: managerContextUnitA,
          targetMember: {
            userId: "broker-1",
            role: "broker",
            branchId: unitA,
          },
          proposed: {
            role: "broker",
            branchId: unitB,
          },
        });
      }).toThrow(AuthorizationError);
    });

    it("allows Multi-Unit Manager (A+B) to move Broker from Unit A to Unit B", () => {
      expect(() => {
        requireCanUpdateMemberAuthority({
          actorContext: managerContextMultiUnitAB,
          targetMember: {
            userId: "broker-1",
            role: "broker",
            branchId: unitA,
          },
          proposed: {
            role: "broker",
            branchId: unitB,
          },
        });
      }).not.toThrow();
    });

    it("prevents Manager from assigning a custom role with tenant-wide scope", () => {
      expect(() => {
        requireCanUpdateMemberAuthority({
          actorContext: managerContextUnitA,
          targetMember: {
            userId: "broker-1",
            role: "broker",
            branchId: unitA,
          },
          proposed: {
            role: "broker",
            branchId: unitA,
            customRoleScope: "tenant",
          },
        });
      }).toThrow(AuthorizationError);
    });

    it("allows Director to update role, branch, and assign tenant-wide custom roles", () => {
      expect(() => {
        requireCanUpdateMemberAuthority({
          actorContext: directorContext,
          targetMember: {
            userId: "manager-1",
            role: "manager",
            branchId: unitA,
          },
          proposed: {
            role: "director",
            branchId: null,
            customRoleScope: "tenant",
          },
        });
      }).not.toThrow();
    });
  });
});

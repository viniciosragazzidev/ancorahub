import { describe, expect, it } from "vitest";
import type { TenantContext } from "@/shared/auth/types";
import { resolveErpScope, scopeIncludes } from "./scope";

const context: TenantContext = { tenantId: "tenant-a", userId: "actor-a", role: "director", jobTitle: "director", branchId: "branch-a" };
const unrestricted = { tenantWide: true, ownership: "ANY" as const, unitIds: [] };

describe("ERP role ceiling and delegated scope", () => {
  it("keeps the unit manager confined even if a cargo says tenant-wide", () => {
    const scope = resolveErpScope({ context: { ...context, role: "manager" }, cargo: unrestricted, financial: false, supervisedIds: [] });
    expect(scopeIncludes(scope, { branchId: "branch-a", ownerId: "other" })).toBe(true);
    expect(scopeIncludes(scope, { branchId: "branch-b", ownerId: "other" })).toBe(false);
    expect(resolveErpScope({ context: { ...context, role: "manager", branchId: null }, cargo: unrestricted, financial: false, supervisedIds: [] })).toEqual({ mode: "none" });
  });
  it("never gives a supervisor a colleague's financial record", () => {
    const scope = resolveErpScope({ context: { ...context, role: "supervisor" }, cargo: unrestricted, financial: true, supervisedIds: ["broker-b"] });
    expect(scopeIncludes(scope, { branchId: "branch-a", ownerId: "broker-b" })).toBe(false);
    expect(scopeIncludes(scope, { branchId: "branch-a", ownerId: "actor-a" })).toBe(true);
  });
  it("requires both the team relationship and any cargo unit restriction", () => {
    const scope = resolveErpScope({ context: { ...context, role: "supervisor", customRoleId: "cargo", customRoleScope: "branch" }, cargo: { tenantWide: false, ownership: "SCOPED", unitIds: ["branch-a"] }, financial: false, supervisedIds: ["broker-b"] });
    expect(scopeIncludes(scope, { branchId: "branch-a", ownerId: "broker-b" })).toBe(true);
    expect(scopeIncludes(scope, { branchId: "branch-b", ownerId: "broker-b" })).toBe(false);
    expect(scopeIncludes(scope, { branchId: "branch-a", ownerId: "outsider" })).toBe(false);
  });
  it("does not grant finance staff company-wide data from their job title alone", () => {
    const own = resolveErpScope({ context: { ...context, role: "broker", jobTitle: "finance" }, cargo: unrestricted, financial: true, supervisedIds: [] });
    expect(scopeIncludes(own, { branchId: "branch-b", ownerId: "other" })).toBe(false);
    const delegated = resolveErpScope({ context: { ...context, role: "broker", jobTitle: "finance", customRoleId: "cargo", customRoleScope: "branch" }, cargo: { tenantWide: false, ownership: "SCOPED", unitIds: ["branch-a"] }, financial: true, supervisedIds: [] });
    expect(scopeIncludes(delegated, { branchId: "branch-a", ownerId: "other" })).toBe(true);
    expect(scopeIncludes(delegated, { branchId: "branch-b", ownerId: "other" })).toBe(false);
  });
  it("supports a central functional cargo without extending an ordinary manager", () => {
    const delegated = { ...context, role: "manager" as const, branchId: null, customRoleId: "cargo", customRoleScope: "tenant" as const };
    expect(resolveErpScope({ context: { ...delegated, jobTitle: "finance" }, cargo: unrestricted, financial: true, supervisedIds: [] })).toEqual({ mode: "tenant" });
    expect(resolveErpScope({ context: { ...delegated, jobTitle: "finance" }, cargo: unrestricted, financial: false, supervisedIds: [] })).toEqual({ mode: "none" });
    expect(resolveErpScope({ context: { ...delegated, jobTitle: "operations" }, cargo: unrestricted, financial: false, supervisedIds: [] })).toEqual({ mode: "tenant" });
  });
  it("fails closed for missing teams, revoked scope and narrowed directors", () => {
    expect(resolveErpScope({ context: { ...context, role: "supervisor" }, cargo: unrestricted, financial: false, supervisedIds: [] })).toEqual({ mode: "none" });
    expect(resolveErpScope({ context, cargo: { ...unrestricted, ownership: "NONE" }, financial: false, supervisedIds: [] })).toEqual({ mode: "none" });
    const director = resolveErpScope({ context: { ...context, customRoleId: "cargo", customRoleScope: "own" }, cargo: { ...unrestricted, tenantWide: false, ownership: "SELF" }, financial: false, supervisedIds: [] });
    expect(scopeIncludes(director, { branchId: "branch-a", ownerId: "other" })).toBe(false);
  });
});

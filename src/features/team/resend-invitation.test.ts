import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const tables = Object.fromEntries(["tenants", "branches", "user", "tenantMemberships", "brokerProfiles", "brokerInvitations", "whatsappOutboundMessages", "auditLogs"].map(name => [name,
    Object.fromEntries(["id", "tenantId", "userId", "role", "jobTitle", "customRoleId", "branchId", "status", "name", "email", "brokerProfileId", "createdAt", "recipientId", "purpose"].map(column => [column, `${name}.${column}`])),
  ]));
  const profileId = "00000000-0000-4000-8000-000000000001";
  const memberId = "00000000-0000-4000-8000-000000000002";
  const userId = "00000000-0000-4000-8000-000000000003";
  const controls = { enabled: true, profileExists: true, membershipExists: false, branchExists: true, delivery: "queued" };
  const profile = { id: profileId, tenantId: "tenant-a", userId: null as string | null, branchId: "branch-a", professionalName: "Pessoa Teste", invitedEmail: "pessoa@example.com", phone: "5511999999999", lifecycleStatus: "INVITED", activatedAt: null as Date | null };
  const membership = { id: memberId, userId, role: "broker", jobTitle: "broker", customRoleId: null as string | null, branchId: "branch-a", status: "active", userStatus: "pending", name: "Pessoa Teste", email: "pessoa@example.com" };
  const invitations = { requested: null as Record<string, unknown> | null, previous: null as Record<string, unknown> | null };
  const context = { tenantId: "tenant-a", userId: "director-a", role: "director", branchId: "branch-a" };
  const writes: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const filters: unknown[] = [];
  const create = vi.fn(async () => ({ id: "new-invitation", token: "new-token", expiresAt: new Date("2026-09-28T12:00:00Z") }));
  function query(table: unknown) {
    let ordered = false;
    const rows = () => table === tables.tenants ? [{ id: "tenant-a" }]
      : table === tables.brokerProfiles ? controls.profileExists ? [profile] : []
      : table === tables.tenantMemberships ? controls.membershipExists ? [membership] : []
      : table === tables.branches ? controls.branchExists ? [{ id: "branch-a" }] : []
      : table === tables.brokerInvitations ? (ordered ? invitations.previous : invitations.requested) ? [ordered ? invitations.previous : invitations.requested] : [] : [];
    const chain = {
      innerJoin: () => chain,
      where: (filter: unknown) => { filters.push(filter); return chain; },
      orderBy: () => { ordered = true; return chain; },
      limit: () => chain,
      for: () => chain,
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows()).then(resolve),
    };
    return chain;
  }
  const db = {
    select: () => ({ from: query }),
    update: (table: unknown) => ({ set: (values: Record<string, unknown>) => ({ where: async (filter: unknown) => { filters.push(filter); writes.push({ table, values }); } }) }),
    insert: (table: unknown) => ({ values: (values: Record<string, unknown>) => {
      writes.push({ table, values });
      return { returning: async () => [{ ...profile, ...values }], then: (resolve: () => unknown) => Promise.resolve().then(resolve) };
    } }),
    transaction: vi.fn(),
  };
  db.transaction.mockImplementation(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db));
  return { tables, db, controls, profile, membership, invitations, context, writes, filters, create, profileId, memberId, userId };
});

vi.mock("@/shared/db", () => ({ getDatabase: () => state.db, schema: state.tables }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: async () => state.controls.enabled ? "true" : "false" }));
vi.mock("./onboarding-helpers", () => ({ createBrokerInvitation: state.create, generateNextInternalCode: async () => "COR-000001" }));
vi.mock("./broker-invitation-delivery", () => ({ enqueueBrokerInvitation: vi.fn(async () => state.controls.delivery) }));
vi.mock("drizzle-orm", () => ({ and: (...values: unknown[]) => values, or: (...values: unknown[]) => values,
  eq: (field: unknown, value: unknown) => ({ field, value }), desc: (field: unknown) => field,
  inArray: (field: unknown, value: unknown) => ({ field, value }) }));

import { resendTeamInvitation } from "./resend-invitation";
import { enqueueBrokerInvitation } from "./broker-invitation-delivery";

describe("resendTeamInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.writes.length = 0; state.filters.length = 0;
    Object.assign(state.controls, { enabled: true, profileExists: true, membershipExists: false, branchExists: true, delivery: "queued" });
    Object.assign(state.profile, { lifecycleStatus: "INVITED", activatedAt: null, userId: null, phone: "5511999999999" });
    Object.assign(state.membership, { role: "broker", jobTitle: "broker", customRoleId: null, branchId: "branch-a", status: "active", userStatus: "pending" });
    Object.assign(state.context, { role: "director", branchId: "branch-a" });
    Object.assign(state.invitations, { requested: null, previous: null });
  });

  it.each([null, "PENDING", "EXPIRED", "REVOKED", "REPLACED"])("renews a %s or missing invitation and dispatches the new ID", async (status) => {
    if (status) state.invitations.previous = { id: "old", status, expiresAt: new Date(0), role: "manager", jobTitle: "manager", customRoleId: "custom-role" };
    const result = await resendTeamInvitation(state.profileId);
    expect(result).toMatchObject({ invitationId: "new-invitation", token: "new-token", whatsappStatus: "queued" });
    expect(state.create).toHaveBeenCalledWith(state.db, "tenant-a", "branch-a", state.profileId, "pessoa@example.com", status ? "manager" : "broker", status ? "manager" : "broker", status ? "custom-role" : null);
    expect(enqueueBrokerInvitation).toHaveBeenCalledWith(expect.objectContaining({ invitationId: "new-invitation", tenantId: "tenant-a", requestedBy: "director-a" }));
    expect(state.writes).toContainEqual({ table: state.tables.auditLogs, values: expect.objectContaining({ entidadeId: "new-invitation", acao: "reenviou_convite" }) });
    expect(state.writes).toContainEqual({ table: state.tables.whatsappOutboundMessages, values: expect.objectContaining({ status: "cancelled" }) });
  });
  it("resolves membership ID and uses current authority instead of an old invitation", async () => {
    state.controls.membershipExists = true; state.profile.userId = state.userId;
    state.invitations.previous = { role: "director", jobTitle: "director", customRoleId: "old-role" };
    await resendTeamInvitation(state.memberId);
    expect(state.create).toHaveBeenCalledWith(state.db, "tenant-a", "branch-a", state.profileId, "pessoa@example.com", "broker", "broker", null);
    expect(JSON.stringify(state.filters)).toContain('"field":"tenantMemberships.tenantId","value":"tenant-a"');
    expect(JSON.stringify(state.filters)).toContain('"field":"brokerProfiles.tenantId","value":"tenant-a"');
  });
  it("accepts an old invitation ID without requiring it to be pending", async () => {
    state.invitations.requested = { brokerProfileId: state.profileId, status: "REVOKED" };
    await resendTeamInvitation("00000000-0000-4000-8000-000000000009");
    expect(state.create).toHaveBeenCalledOnce();
  });
  it("prepares a legacy pending member without a profile and returns a manual link when phone is missing", async () => {
    state.controls.profileExists = false; state.controls.membershipExists = true;
    const result = await resendTeamInvitation(state.memberId);
    expect(result.whatsappStatus).toBe("not_available");
    expect(result.token).toBe("new-token");
    expect(enqueueBrokerInvitation).not.toHaveBeenCalled();
    expect(state.writes).toContainEqual({ table: state.tables.brokerProfiles, values: expect.objectContaining({ userId: state.userId, tenantId: "tenant-a" }) });
  });
  it.each(["active", "disabled", "missing", "outside branch", "broker", "flag", "archived"])("rejects %s before creating or sending a token", async reason => {
    if (reason === "active") state.profile.activatedAt = new Date();
    if (reason === "disabled") { state.controls.membershipExists = true; state.membership.status = "inactive"; }
    if (reason === "missing") state.controls.profileExists = false;
    if (reason === "outside branch") Object.assign(state.context, { role: "manager", branchId: "branch-b" });
    if (reason === "broker") state.context.role = "broker";
    if (reason === "flag") state.controls.enabled = false;
    if (reason === "archived") state.profile.lifecycleStatus = "ARCHIVED";
    await expect(resendTeamInvitation(state.profileId)).rejects.toThrow();
    expect(state.create).not.toHaveBeenCalled(); expect(enqueueBrokerInvitation).not.toHaveBeenCalled();
  });
  it("reports a queue failure without claiming delivery", async () => {
    state.controls.delivery = "failed";
    expect(await resendTeamInvitation(state.profileId)).toMatchObject({ whatsappStatus: "failed", token: "new-token" });
  });
  it("retains the new link when enqueue throws after commit", async () => {
    vi.mocked(enqueueBrokerInvitation).mockRejectedValueOnce(new Error("Queue unavailable"));
    expect(await resendTeamInvitation(state.profileId)).toMatchObject({ whatsappStatus: "failed", token: "new-token" });
  });
  it("rejects invalid identifiers", async () => {
    await expect(resendTeamInvitation("not-an-id")).rejects.toThrow();
    expect(state.create).not.toHaveBeenCalled();
  });
});

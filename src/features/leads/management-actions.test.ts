import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const schema = {
    leads: { id: "leads.id", nome: "leads.nome", tenantId: "leads.tenantId", branchId: "leads.branchId", status: "leads.status", corretorId: "leads.corretorId", distributionStatus: "leads.distributionStatus", firstContactAt: "leads.firstContactAt", serviceStartedAt: "leads.serviceStartedAt", archivedAt: "leads.archivedAt", deletedAt: "leads.deletedAt", queueId: "leads.queueId" },
    leadOffers: { tenantId: "offers.tenantId", leadId: "offers.leadId", brokerId: "offers.brokerId", outboundMessageId: "offers.outboundMessageId", status: "offers.status" },
    whatsappOutboundMessages: { tenantId: "outbound.tenantId", id: "outbound.id", status: "outbound.status" },
    leadAssignmentAttempts: { tenantId: "attempts.tenantId", leadId: "attempts.leadId", brokerId: "attempts.brokerId", status: "attempts.status" },
    leadDistributionEvents: "leadDistributionEvents",
    leadDistributionJobs: { tenantId: "jobs.tenantId", leadId: "jobs.leadId", status: "jobs.status" },
    auditLogs: "auditLogs",
  };
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const lead = {
    id: "00000000-0000-4000-8000-000000000001",
    tenantId: "tenant-test",
    branchId: "branch-test",
    queueId: "queue-test",
    nome: "Lead de teste",
    corretorId: "00000000-0000-4000-8000-000000000002",
    status: "distributed",
    distributionStatus: "assigned",
    firstContactAt: null as Date | null,
    serviceStartedAt: null as Date | null,
    archivedAt: null as Date | null,
    deletedAt: null as Date | null,
  };
  const db = {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() => table === schema.leads
          ? { limit: vi.fn(async () => [{ ...lead }]) }
          : Promise.resolve([{ outboundMessageId: "outbound-test" }]),
        ),
      })),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: Record<string, unknown>) => {
        updates.push({ table, values });
        return {
          where: vi.fn(() => {
            const result = Promise.resolve(undefined) as Promise<unknown> & { returning?: () => Promise<Array<{ id: string }>> };
            result.returning = async () => table === schema.leads ? [{ id: lead.id }] : [];
            return result;
          }),
        };
      }),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(async (values: Record<string, unknown>) => { inserts.push({ table, values }); }),
    })),
    transaction: vi.fn(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)),
  };
  return {
    db,
    inserts,
    lead,
    mockTenantContext: { tenantId: "tenant-test", userId: "director-test", role: "director" as const },
    schema,
    updates,
  };
});

vi.mock("@/shared/db", () => ({ getDatabase: () => state.db, schema: state.schema }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: () => Promise.resolve(state.mockTenantContext) }));
vi.mock("@/shared/auth/errors", () => ({ AuthorizationError: class AuthorizationError extends Error {} }));
vi.mock("@/shared/auth/authorization-service", () => ({ AuthorizationService: { can: () => true } }));
vi.mock("@/features/leads/lead-authorization", () => ({ buildLeadResourceScope: (lead: unknown) => lead, toEffectiveLeadAccessContext: (context: unknown) => context }));
vi.mock("@/shared/auth/shadow-mode", () => ({ evaluateShadowAuthorization: vi.fn(async () => undefined) }));
vi.mock("@/features/notifications/send-push-helper", () => ({ notifyLeadReassigned: vi.fn() }));
vi.mock("@/features/leads/publish-lead-invalidation", () => ({ publishLeadInvalidation: vi.fn(async () => undefined) }));
vi.mock("@/features/leads/webhooks/services/lead-effect-outbox", () => ({ enqueueLeadEffectTx: vi.fn(), runLeadEffectOutboxProcessor: vi.fn() }));
vi.mock("@/shared/async/after-response", () => ({ scheduleAfterResponse: vi.fn() }));
vi.mock("@/features/leads/assignment", () => ({ checkBrokerScheduleAvailability: vi.fn() }));
vi.mock("@/shared/observability/request-timing", () => ({ withServerActionTiming: (_path: string, _name: string, action: () => Promise<unknown>) => action() }));
vi.mock("drizzle-orm", () => ({
  and: (...values: unknown[]) => values,
  eq: (field: unknown, value: unknown) => ({ field, value }),
  inArray: (field: unknown, values: unknown[]) => ({ field, values }),
  isNull: (field: unknown) => ({ field, null: true }),
}));

import { removeLeadAssignmentAction } from "./management-actions";

function formData() {
  const data = new FormData();
  data.set("leadId", state.lead.id);
  return data;
}

describe("removeLeadAssignmentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.updates.length = 0;
    state.inserts.length = 0;
    Object.assign(state.lead, {
      corretorId: "00000000-0000-4000-8000-000000000002",
      status: "distributed",
      distributionStatus: "assigned",
      firstContactAt: null,
      serviceStartedAt: null,
      archivedAt: null,
      deletedAt: null,
    });
  });

  it.each([
    ["antes do início", "distributed", null, null],
    ["depois do início", "in_contact", new Date("2026-09-23T10:00:00Z"), new Date("2026-09-23T10:00:00Z")],
  ])("remove a atribuição %s, preserva histórico, audita e cria espera manual", async (_case, status, firstContactAt, serviceStartedAt) => {
    Object.assign(state.lead, { status, firstContactAt, serviceStartedAt });

    const result = await removeLeadAssignmentAction({}, formData());

    expect(result).toMatchObject({ success: true, entity: { corretorId: null, distributionStatus: "manual_hold" } });
    const leadUpdate = state.updates.find((update) => update.table === state.schema.leads);
    expect(leadUpdate?.values).toMatchObject({ corretorId: null, distributionStatus: "manual_hold" });
    expect(leadUpdate?.values).not.toHaveProperty("status");
    expect(leadUpdate?.values).not.toHaveProperty("firstContactAt");
    expect(leadUpdate?.values).not.toHaveProperty("serviceStartedAt");
    expect(state.inserts).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: state.schema.leadDistributionEvents, values: expect.objectContaining({ action: "assignment_removed", newOwnerId: null }) }),
      expect.objectContaining({ table: state.schema.auditLogs, values: expect.objectContaining({ acao: "lead.assignment_removed" }) }),
    ]));
  });

  it.each(["lost", "converted"])("does not remove an ended lead (%s)", async (status) => {
    state.lead.status = status;

    const result = await removeLeadAssignmentAction({}, formData());

    expect(result).toMatchObject({ error: expect.any(String) });
    expect(state.db.transaction).not.toHaveBeenCalled();
    expect(state.inserts).toHaveLength(0);
  });
});

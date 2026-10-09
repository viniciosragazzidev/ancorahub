import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/pg-proxy";
import * as schema from "@/shared/db/schema";
import type { TenantContext } from "@/shared/auth/types";
import { createRosterAssignmentAction } from "./roster-actions";
import { getDutyRosterSnapshot } from "./roster-queries";
import { getRosterBrokerAccountFilter } from "./roster-broker-account-filter";
import { PgDialect } from "drizzle-orm/pg-core";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

const mocks = vi.hoisted(() => ({ database: vi.fn(), context: vi.fn(), flag: vi.fn(), wake: vi.fn() }));
vi.mock("@/shared/db", async () => ({ schema: await vi.importActual("@/shared/db/schema"), getDatabase: mocks.database }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mocks.context }));
vi.mock("@/features/system-settings/queries", async () => ({
  FEATURE_FLAGS: (await vi.importActual<typeof import("@/shared/feature-flags/catalog")>("@/shared/feature-flags/catalog")).FEATURE_FLAGS,
  getFeatureFlag: mocks.flag,
}));
vi.mock("./jobs", () => ({ wakeLeadsAwaitingEligibleBroker: mocks.wake }));

const tenantId = "11111111-1111-4111-8111-111111111111";
const branchId = "22222222-2222-4222-8222-222222222222";
const scheduleId = "33333333-3333-4333-8333-333333333333";
const context: TenantContext = { tenantId, branchId: null, userId: "director", role: "director", jobTitle: "director" };
const queries: { sql: string; params: unknown[] }[] = [];
let scheduleRow: unknown[];
let publishedDates: string[];
let broker: { tenantId: string; branchId: string; id: string; role: string; jobTitle: string; active: boolean; status: string; membershipStatus: string };

// In-memory executor of the predicates used by the real Drizzle query. No DB connection.
function equalsMatch(query: string, params: unknown[], table: string, column: string, value: unknown) {
  const matches = query.matchAll(new RegExp(`"${table}"\\."${column}" = \\$(\\d+)`, "g"));
  return [...matches].every((match) => params[Number(match[1]) - 1] === value);
}

beforeEach(() => {
  vi.clearAllMocks();
  queries.length = 0;
  scheduleRow = [scheduleId, "Plantão sintético", branchId, "2026-10-01T00:00:00Z", null, "active", null];
  publishedDates = [];
  broker = { tenantId, branchId, id: "broker-disabled", role: "broker", jobTitle: "broker", active: false, status: "disabled", membershipStatus: "inactive" };
  mocks.context.mockResolvedValue(context);
  mocks.flag.mockResolvedValue("true");
  mocks.wake.mockResolvedValue(0);
  const db = drizzle(async (query, params) => {
    queries.push({ sql: query, params });
    if (query.includes('from "unit_duty_schedules"') && !query.includes('join')) {
      return { rows: query.includes('"maximum_brokers"')
        ? [scheduleRow] : [] };
    }
    if (query.startsWith("select distinct") && query.includes('"monthly_plan_id" is not null')) return { rows: publishedDates.map((date) => [date]) };
    if (query.includes('from "branches"')) return { rows: [[branchId, "Unidade sintética", false]] };
    if (query.includes('from "tenant_memberships"')) {
      const allowed = [
        equalsMatch(query, params, "tenant_memberships", "tenant_id", broker.tenantId),
        equalsMatch(query, params, "tenant_memberships", "user_id", broker.id),
        equalsMatch(query, params, "tenant_memberships", "branch_id", broker.branchId),
        equalsMatch(query, params, "tenant_memberships", "role", broker.role),
        equalsMatch(query, params, "tenant_memberships", "job_title", broker.jobTitle),
        equalsMatch(query, params, "tenant_memberships", "status", broker.membershipStatus),
        equalsMatch(query, params, "user", "active", broker.active),
        equalsMatch(query, params, "user", "status", broker.status),
        !query.includes('"user"."status" in') || params.includes(broker.status),
      ].every(Boolean);
      if (!allowed) return { rows: [] };
      return { rows: [query.includes('"user"."name"')
        ? [broker.id, "Corretor sintético", "test@example.invalid", null, branchId, "Unidade sintética", "offline"]
        : [broker.id, broker.branchId]] };
    }
    return { rows: [] };
  }, { schema });
  mocks.database.mockReturnValue(Object.assign(db, {
    transaction: async <T>(work: (tx: typeof db) => Promise<T>) => work(db),
  }));
});

function assignment() {
  const form = new FormData();
  Object.entries({ scheduleId, brokerId: "broker-disabled", dayOfWeek: "1", startsAt: "09:00", endsAt: "12:00", tenantId: "forged-tenant" })
    .forEach(([key, value]) => form.set(key, value));
  return form;
}

describe("inactive brokers in duty planning", () => {
  it("lists disabled brokers for planning", async () => {
    const snapshot = await getDutyRosterSnapshot(context);
    expect(snapshot.brokers.map((row) => row.id)).toContain(broker.id);
  });

  it("adds a disabled broker with audit but never reactivates the account", async () => {
    expect(await createRosterAssignmentAction({}, assignment())).toEqual({ success: true });
    expect(queries.some((q) => q.sql.startsWith('insert into "duty_roster_assignments"'))).toBe(true);
    expect(queries.some((q) => q.sql.startsWith('insert into "audit_logs"'))).toBe(true);
    expect(queries.some((q) => /^(update|delete)/.test(q.sql))).toBe(false);
    expect(queries.flatMap((q) => q.params)).not.toContain("forged-tenant");
  });

  it("restores the active-account requirement when disabled by Super-admin", async () => {
    mocks.flag.mockResolvedValue("false");
    expect((await createRosterAssignmentAction({}, assignment())).error).toBeTruthy();
    expect((await getDutyRosterSnapshot(context)).brokers).toHaveLength(0);
    expect(queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
  });

  it.each(["other-tenant", "other-branch", "not-broker", "pending"])("rejects %s", async (scenario) => {
    if (scenario === "other-tenant") broker.tenantId = "outside-tenant";
    if (scenario === "other-branch") broker.branchId = "outside-branch";
    if (scenario === "not-broker") broker.role = "manager";
    if (scenario === "pending") broker.status = "pending";
    expect((await createRosterAssignmentAction({}, assignment())).error).toBeTruthy();
    expect(queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
  });

  it("keeps broker users from managing the roster", async () => {
    mocks.context.mockResolvedValue({ ...context, role: "broker", jobTitle: "broker" });
    expect((await createRosterAssignmentAction({}, assignment())).error).toMatch(/Gestores e Diretores/);
    expect(queries).toHaveLength(0);
  });

  it("keeps a manager within their unit", async () => {
    mocks.context.mockResolvedValue({ ...context, role: "manager", branchId: "outside-branch" });
    expect((await createRosterAssignmentAction({}, assignment())).error).toMatch(/sua unidade/);
    expect(queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
  });

  it("defaults to enabled and only relaxes account state, not identity", async () => {
    expect(FEATURE_FLAGS.DUTY_INACTIVE_BROKERS.defaultValue).toBe("true");
    const filter = await getRosterBrokerAccountFilter();
    expect(filter).toBeDefined();
    const query = new PgDialect().sqlToQuery(filter!);
    expect(query.params).toEqual(["active", "disabled"]);
    expect(mocks.flag).toHaveBeenCalledWith(FEATURE_FLAGS.DUTY_INACTIVE_BROKERS);
  });
});

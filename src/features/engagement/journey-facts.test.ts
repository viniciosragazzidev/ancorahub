import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks = vi.hoisted(() => ({ flags: vi.fn(), db: { select: vi.fn(), execute: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => mocks.db }));
vi.mock("@/features/system-settings/queries", () => ({ FEATURE_FLAGS: { DUTY_MONTHLY_SCHEDULING: "monthly" }, getFeatureFlag: mocks.flags }));
import { schema } from "@/shared/db";
import { readJourneyFacts } from "./journey-facts";
const now = new Date("2026-10-10T20:00:00Z");
const roster = [{ brokerId: "broker-text", scheduleId: "duty", dutyDate: null, monthlyPlanId: null, dayOfWeek: 6, startsAt: "06:00", timezone: "America/Sao_Paulo", validFrom: new Date("2026-10-10T03:00:00Z"), validUntil: null, scheduleFrom: new Date("2026-10-10T03:00:00Z"), scheduleUntil: null }];
const fixtures = new Map<unknown, unknown[]>();
const queries: { sql: string; params: unknown[] }[] = [];
function query(rows: unknown[]) {
  const p = Promise.resolve(rows);
  const q = { where: () => q, innerJoin: () => q, then: p.then.bind(p) };
  return q;
}
beforeEach(() => {
  vi.clearAllMocks(); fixtures.clear(); queries.length = 0;
  mocks.flags.mockResolvedValue("false");
  fixtures.set(schema.tenantMemberships, [{ brokerId: "broker-text", branchId: "branch", supervisorId: "super" }]);
  fixtures.set(schema.dutyRosterAssignments, roster);
  mocks.db.select.mockImplementation(() => ({ from: (table: unknown) => query(fixtures.get(table) ?? []) }));
  mocks.db.execute.mockImplementation(async (statement) => {
    const q = new PgDialect().sqlToQuery(statement); queries.push(q);
    if (q.sql.includes("sum(points)")) return [{ broker: "broker-text", day: "2026-10-10", points: 30, contacts: 2, fast: 2, ontime: 2, accepted: 1, returned: 0 }];
    if (q.sql.includes("first_contact")) return [{ broker: "broker-text", day: "2026-10-10", received: 2, breaches: 1, fast: 1 }];
    if (q.sql.includes("as service")) return [{ broker: "broker-text", day: "2026-10-10", service: 12 }];
    if (q.sql.includes("with normalized")) return [{ broker: "broker-text", day: "2026-10-10", notes: 12 }];
    if (q.sql.includes("as offers")) return [{ broker: "broker-text", day: "2026-10-10", offers: 1, accepted: 1 }];
    return [];
  });
});
it("batches sources, computes SLA from human sends and does not interpolate Dates", async () => {
  const [fact] = await readJourneyFacts("tenant", ["broker-text"], now, 15);
  expect(fact?.totalPoints).toBe(30);
  expect(fact?.days.find((d) => d.date === "2026-10-10")).toMatchObject({ receivedLeads: 2, slaBreaches: 1, fastContacts: 1, serviceLeads: 12, validNotes: 12 });
  expect(fact?.evidence.fastContacts).toBe(2); // Career evidence survives a later assignment.
  const sla = queries.find((q) => q.sql.includes("first_contact"))!;
  expect(sla.sql).toContain("min(w.sent_at)"); expect(sla.sql).toContain("w.sender_role in ('user','agent')");
  expect(sla.sql).not.toContain("sla_breached_at");
  for (const q of queries) {
    expect(q.params).toContain("tenant"); expect(q.params).toContain("broker-text");
    expect(q.params.some((p) => p instanceof Date)).toBe(false);
  }
  expect(queries.find((q) => q.sql.includes("with normalized"))?.sql).toContain("length(body)>=40 and rn=1");
});
it("counts a duty today even after the shift ended, using its own roster query", async () => {
  const [fact] = await readJourneyFacts("tenant", ["broker-text"], now, 15);
  expect(fact?.subject.dutyScheduleIds).toEqual(["duty"]);
  expect(fact?.days.find((d) => d.date === "2026-10-10")?.hasDuty).toBe(true);
});
it("respects the monthly feature flag for dated assignments", async () => {
  fixtures.set(schema.dutyRosterAssignments, [{ ...roster[0], dutyDate: "2026-10-10", monthlyPlanId: "plan" }]);
  expect((await readJourneyFacts("tenant", ["broker-text"], now, 15))[0]?.subject.dutyScheduleIds).toEqual([]);
  mocks.flags.mockResolvedValue("true");
  expect((await readJourneyFacts("tenant", ["broker-text"], now, 15))[0]?.subject.dutyScheduleIds).toEqual(["duty"]);
});
it("does no source scan for an empty broker batch", async () => {
  expect(await readJourneyFacts("tenant", [], now, 15)).toEqual([]);
  expect(mocks.db.select).not.toHaveBeenCalled(); expect(mocks.db.execute).not.toHaveBeenCalled();
});

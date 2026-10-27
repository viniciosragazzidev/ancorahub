import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import postgres from "postgres";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", async () => ({ getDatabase: vi.fn(), schema: await import("@/shared/db/schema") }));

import { buildColdRecoveriesQuery } from "./loaders";
import type { LiveScope } from "./types";

// Opt-in SELECT-only PostgreSQL test. CTEs shadow every table used by the real
// query: no application rows are read, created or changed, even on a live server.
const url = process.env.COLD_RECOVERY_FIXTURE_DB_URL;
const now = new Date("2026-10-27T13:00:00Z");
const since = new Date("2026-10-26T22:00:00Z");
const director: LiveScope = { tenantId: "fixture-a", userId: "fixture-director", role: "director", branchId: null, key: "fixture-a", canOpenQualification: true };

function fixtureLead(id: string, branch = "branch-a", classification = "hot", tenant = "fixture-a") {
  return { id, tenant_id: tenant, branch_id: branch, qualification_status: classification, status: "new" };
}
const leads = [
  fixtureLead("real-hot"), fixtureLead("real-warm", "branch-a", "warm"),
  fixtureLead("story"), fixtureLead("empty"), fixtureLead("before-send"),
  fixtureLead("another-branch", "branch-b"), fixtureLead("another-tenant", "branch-a", "hot", "fixture-b"),
];
const attempts = leads.map((lead) => ({
  tenant_id: lead.tenant_id, recipient_id: lead.id, recipient_type: "lead",
  created_at: "2026-10-27T12:00:00Z", sent_at: "2026-10-27T12:00:00Z",
  idempotency_key: `cold-lead-requalification:fixture:${lead.id}`,
}));
const audits = leads.map((lead) => ({
  entidade: "lead_qualification", entidade_id: lead.id,
  created_at: "2026-10-27T12:20:00Z", acao: `qualification.qualified:${lead.qualification_status}`,
}));
const messages = leads.map((lead) => ({
  tenant_id: lead.tenant_id, lead_id: lead.id, direction: "incoming",
  sent_at: lead.id === "before-send" ? "2026-10-27T11:00:00Z" : "2026-10-27T12:10:00Z",
  message_id: lead.id === "story" ? "false_status@broadcast_fixture" : lead.id === "real-hot" ? null : `fixture_${lead.id}`,
  body: lead.id === "empty" ? "[text]" : "Quero continuar minha cotação.",
}));
const fixture = { leads, attempts: [...attempts, attempts[0]], audits: [...audits, audits[0]], messages };

describe.skipIf(!url)("cold recoveries: actual SQL with synthetic rows", () => {
  it.each([
    { scope: director, attempted: 6, recovered: 3, hot: 2, warm: 1 },
    { scope: { ...director, role: "manager", branchId: "branch-a" } satisfies LiveScope, attempted: 5, recovered: 2, hot: 1, warm: 1 },
    { scope: { ...director, role: "manager", branchId: "branch-b" } satisfies LiveScope, attempted: 1, recovered: 1, hot: 1, warm: 0 },
  ])("counts real replies, excludes stories/empty/early replies and isolates $scope.role/$scope.branchId", async ({ scope, ...expected }) => {
    if (!url) throw new Error("Fixture database URL is required");
    const query = new PgDialect().sqlToQuery(buildColdRecoveriesQuery(scope, since, now));
    const parameters = query.params.map((value: unknown) => {
      if (typeof value !== "string") throw new Error("Unexpected fixture query parameter");
      return value;
    });
    const data = `$${parameters.length + 1}::jsonb`;
    const sql = `with
      leads as (select * from jsonb_to_recordset(${data}->'leads') as t(id text, tenant_id text, branch_id text, qualification_status text, status text, deleted_at timestamptz, archived_at timestamptz)),
      whatsapp_outbound_messages as (select * from jsonb_to_recordset(${data}->'attempts') as t(tenant_id text, recipient_id text, recipient_type text, created_at timestamptz, sent_at timestamptz, idempotency_key text)),
      audit_logs as (select * from jsonb_to_recordset(${data}->'audits') as t(entidade text, entidade_id text, created_at timestamptz, acao text)),
      whatsapp_messages as (select * from jsonb_to_recordset(${data}->'messages') as t(tenant_id text, lead_id text, direction text, sent_at timestamptz, message_id text, body text, media_kind text))
      select * from (${query.sql}) as recovery_metric`;
    const client = postgres(url, { prepare: false, max: 1, connect_timeout: 10 });
    try {
      const rows = await client.begin("read only", (transaction) => transaction.unsafe(sql, [...parameters, client.json(fixture)]));
      expect(rows[0]).toMatchObject(expected);
    } finally {
      await client.end({ timeout: 5 });
    }
  });
});

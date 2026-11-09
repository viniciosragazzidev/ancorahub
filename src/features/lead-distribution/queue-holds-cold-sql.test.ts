import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it, vi } from "vitest";

import * as schema from "@/shared/db/schema";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ schema, getDatabase: () => null }));

const { queueHoldsColdLeadsSql } = await import("./jobs");
const db = drizzle.mock({ schema });

describe("queueHoldsColdLeadsSql", () => {
  // 09/11: in a select list the lead's columns came out unqualified ("queue_id") and the
  // subquery compared the policy with itself, so every cold partial lead was held.
  it("compares the policy with the lead's own queue in a select list (job pre-check)", () => {
    const { sql } = db.select({ id: schema.leads.id, hold: queueHoldsColdLeadsSql() }).from(schema.leads).where(eq(schema.leads.id, "lead")).toSQL();
    expect(sql).toContain('p.tenant_id = "leads"."tenant_id"');
    expect(sql).toContain('p.queue_id = "leads"."queue_id"');
    expect(sql).not.toMatch(/p\.queue_id = "queue_id"/);
  });

  it("keeps the same comparison in a where clause (seed and claim filters)", () => {
    const { sql } = db.select({ id: schema.leads.id }).from(schema.leads).where(queueHoldsColdLeadsSql()).toSQL();
    expect(sql).toContain('p.tenant_id = "leads"."tenant_id"');
    expect(sql).toContain('p.queue_id = "leads"."queue_id"');
  });
});

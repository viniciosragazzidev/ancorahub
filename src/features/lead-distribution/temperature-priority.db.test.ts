/**
 * Distribution order by temperature against a real database, inside one
 * transaction that is ROLLED BACK at the end: nothing is committed and the
 * engine itself (processQueuedLead) is mocked, so no lead is offered.
 * Opt-in only (never part of the normal suite):
 *   RUN_DISTRIBUTION_DB_E2E=1 npx vitest run src/features/lead-distribution/temperature-priority.db.test.ts
 */
import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, ne, notInArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { existsSync, readFileSync } from "node:fs";
import { afterAll, describe, expect, it, vi } from "vitest";

import * as realSchema from "@/shared/db/schema";

vi.mock("server-only", () => ({}));
const state: { tx: unknown } = { tx: null };
vi.mock("@/shared/db", () => ({ schema: realSchema, getDatabase: () => state.tx }));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSettings: async () => [], getSystemSetting: async () => undefined }));
vi.mock("@/features/communication-channels/outbound-service", () => ({ processMetaOutboundBatch: vi.fn() }));
vi.mock("./offers", () => ({ expireOutdatedLeadOffers: vi.fn() }));
const processed: string[] = [];
vi.mock("./service", () => ({
  processQueuedLead: async (_context: unknown, leadId: string) => {
    processed.push(leadId);
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { status: "manual_required" };
  },
}));

const enabled = process.env.RUN_DISTRIBUTION_DB_E2E === "1";
// @next/env skips .env.local under NODE_ENV=test, so read it directly.
function readLocalEnv(name: string) {
  if (!existsSync(".env.local")) return "";
  const line = readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}
const url = enabled ? (readLocalEnv("SUPABASE_DB_URL") || readLocalEnv("DATABASE_URL")) : "";
const client = enabled ? postgres(url, { prepare: false, max: 1 }) : null;
const db = client ? drizzle(client, { schema: realSchema }) : null;

afterAll(async () => { await client?.end({ timeout: 5 }); });

class Rollback extends Error {}

describe.skipIf(!enabled)("distribution order by temperature (real schema, rolled back)", () => {
  it("offers the hot lead first even when it arrived last, then warm or no temperature, then cold", async () => {
    await db!.transaction(async (tx) => {
      state.tx = tx;
      const s = realSchema;
      const [director] = await tx.select({ tenantId: s.tenantMemberships.tenantId }).from(s.tenantMemberships)
        .innerJoin(s.user, eq(s.user.id, s.tenantMemberships.userId))
        .where(and(eq(s.tenantMemberships.role, "director"), eq(s.tenantMemberships.status, "active"), eq(s.user.active, true), eq(s.user.status, "active")))
        .limit(1);
      const tenantId = director.tenantId;

      // Arrival order: cold, no temperature, warm, hot.
      const base = Date.now() - 60 * 60_000;
      const leads = [["cold", "cold"], ["none", "pending"], ["warm", "warm"], ["hot", "hot"]].map(([label, qualificationStatus], index) => ({
        id: randomUUID(), label, qualificationStatus, at: new Date(base + index * 60_000),
      }));
      const ours: string[] = leads.map((lead) => lead.id);
      // Only these leads take part (rolled back): the tenant's other queued leads and jobs step aside.
      await tx.update(s.leadDistributionJobs).set({ status: "completed" }).where(and(eq(s.leadDistributionJobs.tenantId, tenantId), inArray(s.leadDistributionJobs.status, ["pending", "retrying", "processing"])));
      await tx.update(s.leads).set({ deletedAt: new Date() }).where(and(eq(s.leads.tenantId, tenantId), isNull(s.leads.deletedAt), ne(s.leads.distributionStatus, "assigned")));
      for (const lead of leads) {
        await tx.insert(s.leads).values({
          id: lead.id, tenantId, nome: `Teste prioridade ${lead.label}`, telefone: "5521900000009", distributionStatus: "queued",
          qualificationStatus: lead.qualificationStatus, qualificationState: "COMPLETED", createdAt: lead.at, updatedAt: lead.at, distributionUpdatedAt: lead.at,
        } as typeof s.leads.$inferInsert);
        await tx.insert(s.leadDistributionJobs).values({
          id: randomUUID(), tenantId, leadId: lead.id, type: "process_queued_lead", status: "pending", runAfter: new Date(base), idempotencyKey: `process_queued_lead:${lead.id}`, createdAt: lead.at, updatedAt: lead.at,
        });
      }

      const jobs = await import("./jobs");
      const result = await jobs.runLeadDistributionProcessor({ tenantId });
      const order = processed.filter((id) => ours.includes(id)).map((id) => leads.find((lead) => lead.id === id)!.label);
      expect(order).toEqual(["hot", "none", "warm", "cold"]);
      expect(result.claimed).toBeGreaterThanOrEqual(4);

      // Nothing outside our leads was claimed.
      const others = await tx.select({ id: s.leadDistributionJobs.id }).from(s.leadDistributionJobs)
        .where(and(eq(s.leadDistributionJobs.tenantId, tenantId), eq(s.leadDistributionJobs.status, "processing"), notInArray(s.leadDistributionJobs.leadId, ours)));
      expect(others).toEqual([]);
      throw new Rollback();
    }).catch((error) => { if (!(error instanceof Rollback)) throw error; });
  }, 120_000);
});

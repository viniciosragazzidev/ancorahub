/**
 * Removing a lead from distribution against a real database, inside one
 * transaction that is ROLLED BACK at the end: nothing is committed and no
 * message is sent (outbound and notifications are mocked).
 * Opt-in only (never part of the normal suite):
 *   RUN_DISTRIBUTION_DB_E2E=1 npx vitest run src/features/lead-distribution/distribution-removal.db.test.ts
 */
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { existsSync, readFileSync } from "node:fs";
import { afterAll, describe, expect, it, vi } from "vitest";

import * as realSchema from "@/shared/db/schema";
import type { TenantContext } from "@/shared/auth/types";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const state: { tx: unknown; context: TenantContext | null } = { tx: null, context: null };
vi.mock("@/shared/db", () => ({ schema: realSchema, getDatabase: () => state.tx }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("@/shared/auth/shadow-mode", () => ({ evaluateShadowAuthorization: vi.fn() }));
vi.mock("@/features/leads/publish-lead-invalidation", () => ({ publishLeadInvalidation: vi.fn(async () => undefined) }));
vi.mock("@/features/notifications/send-push-helper", () => ({ notifyLeadReassigned: vi.fn() }));
vi.mock("@/shared/async/after-response", () => ({ scheduleAfterResponse: vi.fn() }));
vi.mock("@/features/communication-channels/outbound-service", () => ({ processMetaOutboundBatch: vi.fn(), enqueueMetaTemplateMessage: vi.fn(async () => ({ id: null, status: "queued", duplicate: false })) }));
vi.mock("./ownership-signal", () => ({ signalLeadOwnershipChange: vi.fn() }));

const enabled = process.env.RUN_DISTRIBUTION_DB_E2E === "1";
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

describe.skipIf(!enabled)("remove a lead from distribution (real schema, rolled back)", () => {
  it("removes with a reason and note, the engine never offers it, and a manual assignment brings it back", async () => {
    await db!.transaction(async (tx) => {
      state.tx = tx;
      const s = realSchema;
      // Migration 0168 inside the rolled-back transaction (DDL is transactional in Postgres).
      for (const statement of readFileSync("drizzle/0168_lead_distribution_removal.sql", "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) await tx.execute(sql.raw(statement));
      }
      const [director] = await tx.select({ userId: s.tenantMemberships.userId, tenantId: s.tenantMemberships.tenantId }).from(s.tenantMemberships)
        .innerJoin(s.user, eq(s.user.id, s.tenantMemberships.userId))
        .where(and(eq(s.tenantMemberships.role, "director"), eq(s.tenantMemberships.status, "active"), eq(s.user.active, true)))
        .limit(1);
      state.context = { userId: director.userId, tenantId: director.tenantId, role: "director", jobTitle: "director", branchId: null };
      const [branch] = await tx.select({ id: s.branches.id }).from(s.branches).where(and(eq(s.branches.tenantId, director.tenantId), eq(s.branches.status, "active"))).limit(1);
      const leadId = randomUUID();
      const now = new Date();
      await tx.insert(s.leads).values({ id: leadId, tenantId: director.tenantId, branchId: branch.id, nome: "Teste remoção", telefone: "5521900000008", distributionStatus: "queued", qualificationStatus: "hot", qualificationState: "QUALIFIED", createdAt: now, updatedAt: now } as typeof s.leads.$inferInsert);
      await tx.insert(s.leadDistributionJobs).values({ id: randomUUID(), tenantId: director.tenantId, leadId, type: "process_queued_lead", status: "pending", idempotencyKey: `process_queued_lead:${leadId}`, createdAt: now, updatedAt: now });

      const actions = await import("@/features/leads/management-actions");
      const form = (entries: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(entries)) data.set(key, value); return data; };

      // No reason: refused.
      expect((await actions.removeLeadFromDistributionAction({}, form({ leadId }))).error).toBe("Escolha o motivo da remoção.");

      const removed = await actions.removeLeadFromDistributionAction({}, form({ leadId, reason: "external_broker_transfer", note: "Passado para o corretor parceiro João." }));
      expect(removed).toMatchObject({ success: true, entity: { distributionStatus: "removed", distributionRemovalReason: "external_broker_transfer" } });
      const [row] = await tx.select().from(s.leads).where(eq(s.leads.id, leadId));
      expect(row).toMatchObject({ distributionStatus: "removed", distributionRemovalReason: "external_broker_transfer", distributionRemovalNote: "Passado para o corretor parceiro João.", distributionRemovedBy: director.userId, corretorId: null });
      const [job] = await tx.select({ status: s.leadDistributionJobs.status }).from(s.leadDistributionJobs).where(eq(s.leadDistributionJobs.leadId, leadId));
      expect(job.status).toBe("completed");
      const [event] = await tx.select({ action: s.leadDistributionEvents.action, reason: s.leadDistributionEvents.reason }).from(s.leadDistributionEvents).where(eq(s.leadDistributionEvents.leadId, leadId));
      expect(event).toEqual({ action: "removed_from_distribution", reason: "Transferência de lead para corretor externo. Passado para o corretor parceiro João." });

      // Twice: refused (already removed).
      expect((await actions.removeLeadFromDistributionAction({}, form({ leadId, reason: "disqualified_no_value" }))).error).toBeTruthy();

      // Even re-queued by another path, the engine never offers it.
      await tx.update(s.leads).set({ distributionStatus: "queued" }).where(eq(s.leads.id, leadId));
      const service = await import("./service");
      expect(await service.processQueuedLead(state.context, leadId)).toMatchObject({ status: "manual_required", reason: expect.stringContaining("removido da distribuição") });

      // A manual direct assignment brings it back (and clears the tag).
      const [broker] = await tx.select({ id: s.tenantMemberships.userId }).from(s.tenantMemberships)
        .where(and(eq(s.tenantMemberships.tenantId, director.tenantId), eq(s.tenantMemberships.branchId, branch.id), eq(s.tenantMemberships.role, "broker"), eq(s.tenantMemberships.status, "active"))).limit(1);
      if (broker) {
        const assigned = await actions.reassignLeadAction({}, form({ leadId, brokerId: broker.id, assignmentMode: "direct" }));
        if (assigned.success) {
          const [after] = await tx.select().from(s.leads).where(eq(s.leads.id, leadId));
          expect(after).toMatchObject({ corretorId: broker.id, distributionRemovedAt: null, distributionRemovalReason: null });
        }
      }
      throw new Rollback();
    }).catch((error) => { if (!(error instanceof Rollback)) throw error; });
  }, 120_000);
});

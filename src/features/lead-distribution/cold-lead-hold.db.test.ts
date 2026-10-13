/**
 * Exercises processQueuedLead against the real schema in a transaction that is
 * rolled back. Opt-in only:
 * RUN_COLD_LEAD_HOLD_DB_E2E=1 npx vitest run src/features/lead-distribution/cold-lead-hold.db.test.ts
 */
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { afterAll, describe, expect, it, vi } from "vitest";

import * as realSchema from "@/shared/db/schema";
import type { TenantContext } from "@/shared/auth/types";

vi.mock("server-only", () => ({}));
const state: { tx: unknown } = { tx: null };
vi.mock("@/shared/db", () => ({ schema: realSchema, getDatabase: () => state.tx }));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: async () => null }));

const enabled = process.env.RUN_COLD_LEAD_HOLD_DB_E2E === "1";
function readLocalEnv(name: string) {
  if (!existsSync(".env.local")) return "";
  const line = readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "") : "";
}
const url = enabled ? (readLocalEnv("SUPABASE_DB_URL") || readLocalEnv("DATABASE_URL")) : "";
const client = enabled && url ? postgres(url, { prepare: false, max: 1 }) : null;
const db = client ? drizzle(client, { schema: realSchema }) : null;
afterAll(async () => { await client?.end({ timeout: 5 }); });

describe.skipIf(!enabled || !db)("processQueuedLead: retenção fria por fila (rollback)", () => {
  it("retém cold com chave ligada sem escapar pela contingência; mantém desligada, warm e pending no fluxo atual", async () => {
    await db!.transaction(async (tx) => {
      state.tx = tx;
      const s = realSchema;
      const [director] = await tx.select({ tenantId: s.tenantMemberships.tenantId, userId: s.tenantMemberships.userId }).from(s.tenantMemberships)
        .where(and(eq(s.tenantMemberships.role, "director"), eq(s.tenantMemberships.status, "active"))).limit(1);
      expect(director).toBeTruthy();
      const context: TenantContext = { userId: director!.userId, tenantId: director!.tenantId, role: "director", jobTitle: "director", branchId: null };
      const targetQueueId = randomUUID();
      const heldQueueId = randomUUID();
      const openQueueId = randomUUID();
      const missingScheduleId = randomUUID();
      const now = new Date();

      await tx.insert(s.leadQueues).values([
        { id: targetQueueId, tenantId: context.tenantId, name: "Destino manual T121", slug: `destino-${targetQueueId.slice(0, 8)}`, assignmentMode: "manual", status: "active", createdAt: now, updatedAt: now },
        { id: heldQueueId, tenantId: context.tenantId, name: "Fila fria ligada T121", slug: `fria-on-${heldQueueId.slice(0, 8)}`, assignmentMode: "automatic", dutyFallbackPolicy: "fallback_queue", dutyFallbackQueueId: targetQueueId, exclusiveDutyScheduleId: missingScheduleId, exclusiveDutyScheduleIds: [missingScheduleId], status: "active", createdAt: now, updatedAt: now },
        { id: openQueueId, tenantId: context.tenantId, name: "Fila fria desligada T121", slug: `fria-off-${openQueueId.slice(0, 8)}`, assignmentMode: "automatic", dutyFallbackPolicy: "fallback_queue", dutyFallbackQueueId: targetQueueId, exclusiveDutyScheduleId: missingScheduleId, exclusiveDutyScheduleIds: [missingScheduleId], status: "active", createdAt: now, updatedAt: now },
      ]);
      await tx.insert(s.leadDistributionPolicies).values([
        { id: randomUUID(), tenantId: context.tenantId, queueId: heldQueueId, profileKey: null, enabled: true, policy: { holdColdLeads: true }, createdAt: now, updatedAt: now },
        { id: randomUUID(), tenantId: context.tenantId, queueId: openQueueId, profileKey: null, enabled: true, policy: { holdColdLeads: false }, createdAt: now, updatedAt: now },
      ]);
      const leads = [
        { id: randomUUID(), queueId: heldQueueId, qualificationStatus: "cold" },
        { id: randomUUID(), queueId: openQueueId, qualificationStatus: "cold" },
        { id: randomUUID(), queueId: heldQueueId, qualificationStatus: "warm" },
        { id: randomUUID(), queueId: heldQueueId, qualificationStatus: "pending" },
      ] as const;
      await tx.insert(s.leads).values(leads.map((lead) => ({
        id: lead.id,
        tenantId: context.tenantId,
        queueId: lead.queueId,
        nome: "Lead sintético T121",
        telefone: "5521900000000",
        origem: "manual" as const,
        status: "new" as const,
        distributionStatus: "queued" as const,
        qualificationStatus: lead.qualificationStatus,
        qualificationState: "QUALIFIED",
        createdAt: now,
        updatedAt: now,
      })));

      const { processQueuedLead } = await import("./service");
      const held = await processQueuedLead(context, leads[0]!.id);
      expect(held).toMatchObject({ status: "queued", reason: expect.stringMatching(/^cold_held_by_queue/) });
      const [stillInOrigin] = await tx.select({ queueId: s.leads.queueId, brokerId: s.leads.corretorId }).from(s.leads).where(and(eq(s.leads.tenantId, context.tenantId), eq(s.leads.id, leads[0]!.id)));
      expect(stillInOrigin).toEqual({ queueId: heldQueueId, brokerId: null });

      const coldWithoutHold = await processQueuedLead(context, leads[1]!.id);
      expect(coldWithoutHold).toMatchObject({ status: "queued", reason: "A fila está em modo manual." });
      const warm = await processQueuedLead(context, leads[2]!.id);
      expect(warm).toMatchObject({ status: "queued", reason: "A fila está em modo manual." });
      const pending = await processQueuedLead(context, leads[3]!.id);
      expect(pending).toMatchObject({ status: "queued", reason: "A fila está em modo manual." });
      const rerouted = await tx.select({ id: s.leads.id, queueId: s.leads.queueId, brokerId: s.leads.corretorId }).from(s.leads)
        .where(and(eq(s.leads.tenantId, context.tenantId), eq(s.leads.queueId, targetQueueId)));
      expect(rerouted.map((lead) => lead.id)).toEqual(expect.arrayContaining([leads[1]!.id, leads[2]!.id, leads[3]!.id]));

      tx.rollback();
    }).catch((error) => {
      if (!String(error?.message ?? error).includes("Rollback")) throw error;
    });
  }, 60_000);
});

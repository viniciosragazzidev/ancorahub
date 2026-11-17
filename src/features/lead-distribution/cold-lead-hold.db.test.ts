/**
 * Exercises processQueuedLead against the real schema in a transaction that is
 * rolled back. Opt-in only:
 * RUN_COLD_LEAD_HOLD_DB_E2E=1, COLD_LEAD_HOLD_DB_URL equal to ERP_TEST_DATABASE_URL,
 * and ERP_TEST_ROOT=<marked synthetic test folder>
 * npx vitest run src/features/lead-distribution/cold-lead-hold.db.test.ts
 */
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import * as realSchema from "@/shared/db/schema";
import type { TenantContext } from "@/shared/auth/types";
import { assertIsolatedErpTestDataDirectory, getIsolatedErpTestDatabase } from "./isolated-erp-test-db";

vi.mock("server-only", () => ({}));
const state: { tx: unknown } = { tx: null };
vi.mock("@/shared/db", () => ({ schema: realSchema, getDatabase: () => state.tx }));
vi.mock("@/features/system-settings/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/system-settings/queries")>();
  return { ...actual, getSystemSetting: async () => null, getFeatureFlag: async () => "false" };
});

const enabled = process.env.RUN_COLD_LEAD_HOLD_DB_E2E === "1";
function getOptInDatabaseUrl() {
  if (!enabled) return null;
  const candidate = process.env.COLD_LEAD_HOLD_DB_URL?.trim();
  if (!candidate) throw new Error("RUN_COLD_LEAD_HOLD_DB_E2E exige COLD_LEAD_HOLD_DB_URL do Postgres sintético.");
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("COLD_LEAD_HOLD_DB_URL precisa ser uma URL PostgreSQL válida.");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("COLD_LEAD_HOLD_DB_URL precisa usar o protocolo PostgreSQL.");
  }
  const productionProjectRef = "vyxqfyfeocbhrffenlqr";
  const target = `${parsed.hostname} ${parsed.username} ${parsed.pathname}`.toLowerCase();
  if (target.includes(productionProjectRef)) {
    throw new Error("Teste bloqueado: COLD_LEAD_HOLD_DB_URL aponta para o projeto de produção.");
  }
  return candidate;
}
const isolated = enabled ? getIsolatedErpTestDatabase() : null;
const url = getOptInDatabaseUrl();
if (url && isolated && url !== isolated.url) throw new Error("COLD_LEAD_HOLD_DB_URL deve ser igual a ERP_TEST_DATABASE_URL.");
const client = url ? postgres(url, { prepare: false, max: 1 }) : null;
const db = client ? drizzle(client, { schema: realSchema }) : null;
afterAll(async () => { await client?.end({ timeout: 5 }); });
beforeAll(async () => {
  if (!client || !isolated) return;
  const [server] = await client`SHOW data_directory`;
  assertIsolatedErpTestDataDirectory(server.data_directory, isolated.dataDirectory);
});

describe.skipIf(!enabled || !db)("processQueuedLead: retenção fria por fila (rollback)", () => {
  it("retém cold com chave ligada sem escapar pela contingência; mantém desligada, warm e pending no fluxo atual", async () => {
    await db!.transaction(async (tx) => {
      state.tx = tx;
      const s = realSchema;
      const tenantId = randomUUID();
      const directorId = randomUUID();
      await tx.insert(s.user).values({ id: directorId, name: "T121 DB test", email: `t121-db-${directorId}@example.test` });
      await tx.insert(s.tenants).values({ id: tenantId, name: "Tenant isolado T121", slug: `t121-${tenantId}` });
      await tx.insert(s.tenantMemberships).values({
        id: randomUUID(), tenantId, userId: directorId, role: "director", jobTitle: "director", status: "active",
      });
      const context: TenantContext = { userId: directorId, tenantId, role: "director", jobTitle: "director", branchId: null };
      const branchId = randomUUID();
      const targetQueueId = randomUUID();
      const heldQueueId = randomUUID();
      const openQueueId = randomUUID();
      const missingScheduleId = randomUUID();
      const now = new Date();

      await tx.insert(s.branches).values({ id: branchId, tenantId: context.tenantId, name: "Unidade sintética T121", status: "active", acceptingLeads: true, autoDistribute: true, isDistributionHub: false, createdAt: now, updatedAt: now });
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
        branchId,
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

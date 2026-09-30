/**
 * A queue with no destination ("Nenhum (ficam na fila)"), against the real
 * schema inside one transaction that is ROLLED BACK. Opt-in only:
 *   RUN_QUEUE_NO_DESTINATION_DB_E2E=1 npx vitest run src/features/lead-distribution/queue-no-destination.db.test.ts
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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const state: { tx: unknown } = { tx: null };
vi.mock("@/shared/db", () => ({ schema: realSchema, getDatabase: () => state.tx }));

const enabled = process.env.RUN_QUEUE_NO_DESTINATION_DB_E2E === "1";
function readLocalEnv(name: string) {
  if (!existsSync(".env.local")) return "";
  const line = readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}
const url = enabled ? (readLocalEnv("SUPABASE_DB_URL") || readLocalEnv("DATABASE_URL")) : "";
const client = enabled ? postgres(url, { prepare: false, max: 1 }) : null;
const db = client ? drizzle(client, { schema: realSchema }) : null;
afterAll(async () => { await client?.end({ timeout: 5 }); });

describe.skipIf(!enabled)("queue with no destination (rolled back)", () => {
  it("keeps its leads waiting, and switching to distribute wakes them at once", async () => {
    const s = realSchema;
    await db!.transaction(async (tx) => {
      state.tx = tx;
      const [director] = await tx.select({ tenantId: s.tenantMemberships.tenantId, userId: s.tenantMemberships.userId }).from(s.tenantMemberships)
        .where(and(eq(s.tenantMemberships.role, "director"), eq(s.tenantMemberships.status, "active"))).limit(1);
      const context: TenantContext = { userId: director!.userId, tenantId: director!.tenantId, role: "director", jobTitle: "director", branchId: null };
      const { saveDistributionQueue } = await import("./control-service");
      const base = { name: "Fila teste sem destino", assignmentStrategy: "capacity", capacityEnabled: false, capacityPerBroker: null, status: "active" } as const;

      const { id: queueId } = await saveDistributionQueue(context, { ...base, assignmentMode: "manual" });
      expect(queueId).toBeTruthy();

      // A lead waiting in the queue, as the intake leaves it.
      const [branch] = await tx.select({ id: s.branches.id }).from(s.branches).where(eq(s.branches.tenantId, context.tenantId)).limit(1);
      const leadId = randomUUID();
      await tx.insert(s.leads).values({ id: leadId, tenantId: context.tenantId, branchId: branch!.id, queueId, nome: "Lead teste", telefone: "5521900009999", origem: "manual", status: "new", distributionStatus: "queued", qualificationStatus: "ia_disabled" });
      const { processQueuedLead } = await import("./service");
      const held = await processQueuedLead(context, leadId);
      expect(held).toMatchObject({ status: "queued", reason: "A fila está em modo manual." });

      // Destination changed to distribute: its job is due now.
      await saveDistributionQueue(context, { ...base, id: queueId, assignmentMode: "automatic" });
      const [job] = await tx.select({ status: s.leadDistributionJobs.status, runAfter: s.leadDistributionJobs.runAfter }).from(s.leadDistributionJobs).where(eq(s.leadDistributionJobs.leadId, leadId));
      expect(job).toBeTruthy();
      expect(job!.runAfter.getTime()).toBeLessThanOrEqual(Date.now() + 1000);

      tx.rollback();
    }).catch((error) => {
      if (!String(error?.message ?? error).includes("Rollback")) throw error;
    });
  }, 60_000);
});

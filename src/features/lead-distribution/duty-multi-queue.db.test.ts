/**
 * A plantão received by several queues, against the real schema inside one
 * transaction that is ROLLED BACK. Opt-in only:
 *   RUN_DUTY_MULTI_QUEUE_DB_E2E=1 npx vitest run src/features/lead-distribution/duty-multi-queue.db.test.ts
 */
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { existsSync, readFileSync } from "node:fs";
import { afterAll, describe, expect, it, vi } from "vitest";

import * as realSchema from "@/shared/db/schema";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const state: { tx: unknown; context: unknown } = { tx: null, context: null };
vi.mock("@/shared/db", () => ({ schema: realSchema, getDatabase: () => state.tx }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));

const enabled = process.env.RUN_DUTY_MULTI_QUEUE_DB_E2E === "1";
function readLocalEnv(name: string) {
  if (!existsSync(".env.local")) return "";
  const line = readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}
const url = enabled ? (readLocalEnv("SUPABASE_DB_URL") || readLocalEnv("DATABASE_URL")) : "";
const client = enabled ? postgres(url, { prepare: false, max: 1 }) : null;
const db = client ? drizzle(client, { schema: realSchema }) : null;
afterAll(async () => { await client?.end({ timeout: 5 }); });

describe.skipIf(!enabled)("plantão with several queues (rolled back)", () => {
  it("links a new plantão to every chosen queue, and an edit keeps only the queues still chosen", async () => {
    const s = realSchema;
    await db!.transaction(async (tx) => {
      state.tx = tx;
      const [director] = await tx.select({ tenantId: s.tenantMemberships.tenantId, userId: s.tenantMemberships.userId }).from(s.tenantMemberships)
        .where(and(eq(s.tenantMemberships.role, "director"), eq(s.tenantMemberships.status, "active"))).limit(1);
      state.context = { userId: director!.userId, tenantId: director!.tenantId, role: "director", jobTitle: "director", branchId: null };
      const queues = await tx.select({ id: s.leadQueues.id }).from(s.leadQueues)
        .where(and(eq(s.leadQueues.tenantId, director!.tenantId), eq(s.leadQueues.status, "active"))).limit(2);
      expect(queues).toHaveLength(2);
      const linkedTo = async (scheduleId: string) => (await tx.select({ id: s.leadQueues.id }).from(s.leadQueues).where(and(
        eq(s.leadQueues.tenantId, director!.tenantId),
        sql`${s.leadQueues.exclusiveDutyScheduleIds} @> ${JSON.stringify([scheduleId])}::jsonb`,
      ))).map((row) => row.id).sort();

      const { createDutyScheduleAction, updateDutyScheduleAction } = await import("./duty-actions");
      const create = new FormData();
      create.set("name", "Plantão teste duas filas");
      create.set("startsAt", "03:00");
      create.set("endsAt", "03:30");
      create.set("minimumBrokers", "1");
      create.set("validFrom", "2031-01-06");
      create.set("dates", JSON.stringify(["2031-01-06"]));
      create.set("daysOfWeek", JSON.stringify([1]));
      create.set("responsibleQueueIds", JSON.stringify(queues.map((queue) => queue.id)));
      const created = await createDutyScheduleAction({}, create);
      expect(created.error).toBeUndefined();
      const scheduleId = created.scheduleIds![0]!;
      expect(await linkedTo(scheduleId)).toEqual(queues.map((queue) => queue.id).sort());

      const edit = new FormData();
      edit.set("scheduleId", scheduleId);
      edit.set("name", "Plantão teste duas filas");
      edit.set("dayOfWeek", "1");
      edit.set("startsAt", "03:00");
      edit.set("endsAt", "03:30");
      edit.set("minimumBrokers", "1");
      edit.set("validFrom", "2031-01-06");
      edit.set("validUntil", "2031-01-06");
      edit.set("receivingQueueIds", JSON.stringify([queues[1]!.id]));
      const updated = await updateDutyScheduleAction({}, edit);
      expect(updated.error).toBeUndefined();
      expect(await linkedTo(scheduleId)).toEqual([queues[1]!.id]);

      tx.rollback();
    }).catch((error) => {
      if (!String(error?.message ?? error).includes("Rollback")) throw error;
    });
  }, 60_000);
});

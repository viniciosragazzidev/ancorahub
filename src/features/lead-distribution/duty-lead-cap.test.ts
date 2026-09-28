import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it, vi } from "vitest";

import * as realSchema from "@/shared/db/schema";
import { brokersUnderDutyCap } from "./duty-lead-cap";

describe("per-plantão lead cap", () => {
  it("keeps only brokers below this plantão's limit", () => {
    const received = new Map([["ana", 3], ["bia", 5], ["caio", 0]]);
    expect([...brokersUnderDutyCap(["ana", "bia", "caio", "duda"], received, 5)]).toEqual(["ana", "caio", "duda"]);
    expect([...brokersUnderDutyCap(["ana", "bia"], received, 3)]).toEqual([]);
  });
});

vi.mock("server-only", () => ({}));
const state: { tx: unknown } = { tx: null };
vi.mock("@/shared/db", () => ({ schema: realSchema, getDatabase: () => state.tx }));

/**
 * Real schema, inside a transaction that is ROLLED BACK. Opt-in:
 *   RUN_DUTY_DB_E2E=1 npx vitest run src/features/lead-distribution/duty-lead-cap.test.ts
 */
const enabled = process.env.RUN_DUTY_DB_E2E === "1";
function readLocalEnv(name: string) {
  if (!existsSync(".env.local")) return "";
  const line = readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}
const client = enabled ? postgres(readLocalEnv("SUPABASE_DB_URL") || readLocalEnv("DATABASE_URL"), { prepare: false, max: 1 }) : null;
const db = client ? drizzle(client, { schema: realSchema }) : null;
afterAll(async () => { await client?.end({ timeout: 5 }); });
class Rollback extends Error {}

describe.skipIf(!enabled)("per-plantão lead cap count (real schema, rolled back)", () => {
  it("counts the leads each broker received through this plantão in the running occurrence", async () => {
    await db!.transaction(async (tx) => {
      state.tx = tx;
      const s = realSchema;
      const { countLeadsReceivedInDuty } = await import("./duty-lead-cap");
      const [tenant] = await tx.select({ id: s.tenants.id }).from(s.tenants).limit(1);
      const tenantId = tenant.id;
      const [userA, userB] = await tx.select({ id: s.user.id }).from(s.user).limit(2);
      const brokerA = userA.id, brokerB = userB.id;
      const scheduleId = randomUUID(), otherScheduleId = randomUUID();
      const queueId = randomUUID(), otherQueueId = randomUUID();
      await tx.insert(s.leadQueues).values([
        { id: queueId, tenantId, name: "Cap test queue", slug: `cap-test-${queueId.slice(0, 8)}`, exclusiveDutyScheduleIds: [scheduleId] },
        { id: otherQueueId, tenantId, name: "Other plantão queue", slug: `cap-other-${otherQueueId.slice(0, 8)}`, exclusiveDutyScheduleIds: [otherScheduleId] },
      ] as Array<typeof s.leadQueues.$inferInsert>);
      const startsAt = new Date("2026-09-28T12:00:00Z"), endsAt = new Date("2026-09-28T21:00:00Z");
      const lead = (corretorId: string | null, q: string, assignedAt: Date) => ({ id: randomUUID(), tenantId, queueId: q, corretorId, assignedAt, nome: "Cap test", telefone: `55219${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}` });
      await tx.insert(s.leads).values([
        lead(brokerA, queueId, new Date("2026-09-28T12:30:00Z")),
        lead(brokerA, queueId, new Date("2026-09-28T15:00:00Z")),
        lead(brokerB, queueId, new Date("2026-09-28T13:00:00Z")),
        // Before this occurrence, from another plantão's queue, and one that moved to nobody: none count.
        lead(brokerA, queueId, new Date("2026-09-27T15:00:00Z")),
        lead(brokerA, otherQueueId, new Date("2026-09-28T14:00:00Z")),
        lead(null, queueId, new Date("2026-09-28T14:00:00Z")),
      ] as Array<typeof s.leads.$inferInsert>);
      const counts = await countLeadsReceivedInDuty(tx as never, tenantId, { scheduleId, limit: 2, startsAt, endsAt }, [brokerA, brokerB]);
      expect(counts.get(brokerA)).toBe(2);
      expect(counts.get(brokerB)).toBe(1);
      throw new Rollback();
    }).catch((error) => { if (!(error instanceof Rollback)) throw error; });
  }, 60_000);
});

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/shared/db/schema";
import { moveWeeklyRosterAssignment } from "./roster-assignment-move";

const testUrl = process.env.ERP_TEST_DATABASE_URL;
let db: ReturnType<typeof import("@/shared/db").getDatabase> | null = null;
afterAll(async () => { await db?.$client.end({ timeout: 5 }); });

describe.skipIf(!testUrl)("weekly roster move against isolated PostgreSQL", () => {
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (!( ["postgres:", "postgresql:"].includes(url.protocol)
      && ["localhost", "127.0.0.1"].includes(url.hostname)
      && url.port === "5442"
      && url.pathname === "/erp_test"
      && url.username === "erp_test")) {
      throw new Error("Race tests only accept the isolated erp_test database on port 5442.");
    }
    const root = process.env.ERP_TEST_ROOT;
    if (!root) throw new Error("Race tests require ERP_TEST_ROOT provenance marker.");
    const marker = JSON.parse(await fs.readFile(path.join(root, "provenance.json"), "utf8")) as { purpose?: string };
    if (marker.purpose !== "ancorahub-erp-synthetic-tests") throw new Error("Race tests refused an unmarked database.");
    process.env.DATABASE_URL = testUrl;
    process.env.SUPABASE_DB_URL = testUrl;
    delete process.env.DATABASE_SSL;
    const shared = await import("@/shared/db");
    db = shared.getDatabase();
    const result = await db.execute(sql`SHOW data_directory`);
    if (path.resolve(String(result[0].data_directory)).toLowerCase() !== path.resolve(root, "data-erp-test").toLowerCase()) {
      throw new Error("Race tests refused an unexpected PostgreSQL data directory.");
    }
  });

  it("serializes two moves from the same assignment source", async () => {
    if (!db) throw new Error("Isolated test database was not initialized.");
    const tenantId = randomUUID();
    const userId = randomUUID();
    const branchId = randomUUID();
    const sourceScheduleId = randomUUID();
    const targetScheduleA = randomUUID();
    const targetScheduleB = randomUUID();
    const assignmentId = randomUUID();
    const now = new Date();
    const validFrom = new Date("2030-01-01T00:00:00.000Z");
    const expected = { id: assignmentId, tenantId, brokerId: userId, scheduleId: sourceScheduleId, dayOfWeek: 1, startsAt: "09:00", endsAt: "13:00" };
    let ready = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const attempt = (targetId: string) => (async () => {
      ready += 1;
      if (ready === 2) release();
      await barrier;
      return db!.transaction((tx) => moveWeeklyRosterAssignment(tx, {
        expected,
        target: { scheduleId: targetId, dayOfWeek: 2, startsAt: "10:00", endsAt: "14:00", actorId: userId, now },
        prepare: async () => undefined,
      }));
    })();

    try {
      await db.insert(schema.tenants).values({ id: tenantId, name: "Empresa sintética", slug: `race-${tenantId}` });
      await db.insert(schema.user).values({ id: userId, name: "Pessoa sintética", email: `race-${userId}@example.invalid` });
      await db.insert(schema.branches).values({ id: branchId, tenantId, name: "Unidade sintética" });
      await db.insert(schema.unitDutySchedules).values([sourceScheduleId, targetScheduleA, targetScheduleB].map((id) => ({
        id, tenantId, branchId, name: `Plantão ${id}`, dayOfWeek: 1, startsAt: "09:00", endsAt: "13:00", validFrom, createdBy: userId,
      })));
      await db.insert(schema.dutyRosterAssignments).values({
        id: assignmentId, tenantId, branchId, scheduleId: sourceScheduleId, brokerId: userId,
        dayOfWeek: 1, startsAt: "09:00", endsAt: "13:00", validFrom, createdBy: userId, updatedBy: userId,
      });

      const results = await Promise.all([attempt(targetScheduleA), attempt(targetScheduleB)]);
      expect(results.filter(Boolean)).toHaveLength(1);
      const [saved] = await db.select({ scheduleId: schema.dutyRosterAssignments.scheduleId }).from(schema.dutyRosterAssignments)
        .where(and(eq(schema.dutyRosterAssignments.id, assignmentId), eq(schema.dutyRosterAssignments.tenantId, tenantId)));
      expect([targetScheduleA, targetScheduleB]).toContain(saved.scheduleId);
    } finally {
      await db.delete(schema.dutyRosterAssignments).where(sql`${schema.dutyRosterAssignments.id} = ${assignmentId}`);
      await db.delete(schema.unitDutySchedules).where(sql`${schema.unitDutySchedules.tenantId} = ${tenantId}`);
      await db.delete(schema.branches).where(sql`${schema.branches.tenantId} = ${tenantId}`);
      await db.delete(schema.user).where(sql`${schema.user.id} = ${userId}`);
      await db.delete(schema.tenants).where(sql`${schema.tenants.id} = ${tenantId}`);
    }
  }, 30_000);
});

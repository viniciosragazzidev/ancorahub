import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/shared/db/schema";
import { claimDutyPresencePreconfirmation } from "./duty-presence-preconfirm-claim";
import { saveOwnDutyPresenceAnswer } from "./duty-presence-self-confirm";

const testUrl = process.env.ERP_TEST_DATABASE_URL;
let db: ReturnType<typeof import("@/shared/db").getDatabase> | null = null;
afterAll(async () => { await db?.$client.end({ timeout: 5 }); });

describe.skipIf(!testUrl)("duty preconfirmation claim against isolated PostgreSQL", () => {
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (!["postgres:", "postgresql:"].includes(url.protocol)
      || !["localhost", "127.0.0.1"].includes(url.hostname)
      || url.port !== "5442"
      || url.pathname !== "/erp_test"
      || url.username !== "erp_test") {
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

  it("two simultaneous preconfirmations create one confirmed occurrence and one audit", async () => {
    if (!db) throw new Error("Isolated test database was not initialized.");
    const tenantId = randomUUID();
    const userId = randomUUID();
    const branchId = randomUUID();
    const scheduleId = randomUUID();
    const assignmentId = randomUUID();
    const now = new Date();
    const startsAt = new Date(now.getTime() + 60 * 60_000);
    const endsAt = new Date(startsAt.getTime() + 4 * 60 * 60_000);
    const dutyDate = startsAt.toISOString().slice(0, 10);
    let arrived = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const attempt = () => (async () => {
      arrived += 1;
      if (arrived === 2) release();
      await barrier;
      return db!.transaction(async (tx) => {
        const claim = await claimDutyPresencePreconfirmation(tx, {
          tenantId, scheduleId, assignmentId, brokerId: userId, dutyDate, startsAt, endsAt, actorId: userId, now,
        });
        if (claim.kind === "claimed") {
          await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId, entidade: "duty_presence_confirmation", entidadeId: claim.confirmationId, acao: "duty_presence.preconfirmed_contiguous", createdAt: now });
        }
        return claim.kind;
      });
    })();

    try {
      await db.insert(schema.tenants).values({ id: tenantId, name: "Tenant sintético", slug: `race-${tenantId}` });
      await db.insert(schema.user).values({ id: userId, name: "Diretor sintético", email: `${userId}@example.test` });
      await db.insert(schema.branches).values({ id: branchId, tenantId, name: "Unidade sintética" });
      await db.insert(schema.unitDutySchedules).values({
        id: scheduleId, tenantId, name: "Plantão sintético", dayOfWeek: startsAt.getUTCDay(), startsAt: "09:00", endsAt: "13:00",
        validFrom: new Date(now.getTime() - 86_400_000), validUntil: new Date(now.getTime() + 86_400_000), createdBy: userId,
      });
      await db.insert(schema.dutyRosterAssignments).values({
        id: assignmentId, tenantId, branchId, scheduleId, brokerId: userId, dayOfWeek: startsAt.getUTCDay(), startsAt: "09:00", endsAt: "13:00",
        validFrom: new Date(now.getTime() - 86_400_000), validUntil: new Date(now.getTime() + 86_400_000), createdBy: userId, updatedBy: userId,
      });
      const results = await Promise.all([attempt(), attempt()]);
      expect(results.filter((kind) => kind === "claimed")).toHaveLength(1);
      expect(results.filter((kind) => kind === "already_confirmed")).toHaveLength(1);
      const [confirmation] = await db.select({ id: schema.dutyPresenceConfirmations.id, status: schema.dutyPresenceConfirmations.status, confirmedBy: schema.dutyPresenceConfirmations.confirmedBy })
        .from(schema.dutyPresenceConfirmations).where(and(eq(schema.dutyPresenceConfirmations.tenantId, tenantId), eq(schema.dutyPresenceConfirmations.assignmentId, assignmentId)));
      expect(confirmation).toMatchObject({ status: "confirmed", confirmedBy: userId });
      const auditRows = await db.select({ id: schema.auditLogs.id }).from(schema.auditLogs).where(and(eq(schema.auditLogs.entidadeId, confirmation!.id), eq(schema.auditLogs.acao, "duty_presence.preconfirmed_contiguous")));
      expect(auditRows).toHaveLength(1);

      await db.delete(schema.dutyPresenceConfirmations).where(eq(schema.dutyPresenceConfirmations.tenantId, tenantId));
      await db.insert(schema.dutyPresenceConfirmations).values({
        id: randomUUID(), tenantId, scheduleId, assignmentId, brokerId: userId, dutyDate,
        shiftStartsAt: startsAt, shiftEndsAt: endsAt, status: "pending", notificationStatus: "pending",
      });
      let raceArrived = 0;
      let releaseRace!: () => void;
      const raceBarrier = new Promise<void>((resolve) => { releaseRace = resolve; });
      const ready = async () => {
        raceArrived += 1;
        if (raceArrived === 2) releaseRace();
        await raceBarrier;
      };
      const race = await Promise.all([
        (async () => { await ready(); return db!.transaction((tx) => claimDutyPresencePreconfirmation(tx, { tenantId, scheduleId, assignmentId, brokerId: userId, dutyDate, startsAt, endsAt, actorId: userId, now })); })(),
        (async () => { await ready(); return db!.transaction((tx) => saveOwnDutyPresenceAnswer(tx, {
          tenantId, scheduleId, assignmentId, brokerId: userId, dutyDate, startsAt, endsAt, now,
          answer: { status: "confirmed", confirmedAt: now, confirmedBy: null, photoStorageKey: null, photoTakenAt: null, updatedAt: now },
        })); })(),
      ]);
      expect(race.filter((result) => result.kind === "claimed" || result.kind === "saved")).toHaveLength(1);
      const [final] = await db.select({ status: schema.dutyPresenceConfirmations.status })
        .from(schema.dutyPresenceConfirmations).where(and(eq(schema.dutyPresenceConfirmations.tenantId, tenantId), eq(schema.dutyPresenceConfirmations.assignmentId, assignmentId)));
      expect(final.status).toBe("confirmed");
    } finally {
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.userId, userId));
      await db.delete(schema.dutyPresenceConfirmations).where(eq(schema.dutyPresenceConfirmations.tenantId, tenantId));
      await db.delete(schema.dutyRosterAssignments).where(eq(schema.dutyRosterAssignments.tenantId, tenantId));
      await db.delete(schema.unitDutySchedules).where(eq(schema.unitDutySchedules.tenantId, tenantId));
      await db.delete(schema.branches).where(eq(schema.branches.tenantId, tenantId));
      await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
      await db.delete(schema.user).where(eq(schema.user.id, userId));
    }
  }, 30_000);
});

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import * as schema from "@/shared/db/schema";

vi.mock("@/features/system-settings/queries", () => ({ getFeatureFlag: async () => "false", FEATURE_FLAGS: { DUTY_PRESENCE_CONFIRMATION: { key: "x", defaultValue: "false" } } }));

const testUrl = process.env.ERP_TEST_DATABASE_URL;
let db: ReturnType<typeof import("@/shared/db").getDatabase> | null = null;
afterAll(async () => { await db?.$client.end({ timeout: 5 }); });

/** Quarta, 25/11/2026, 14:00 em São Paulo: o plantão começa 14:10 (a confirmação já abriu). */
const now = new Date("2026-11-25T17:00:00.000Z");

describe.skipIf(!testUrl)("foto na confirmação do plantão, decidida no servidor (PostgreSQL isolado)", () => {
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (!(["postgres:", "postgresql:"].includes(url.protocol)
      && ["localhost", "127.0.0.1"].includes(url.hostname)
      && url.port === "5442"
      && url.pathname === "/erp_test"
      && url.username === "erp_test")) {
      throw new Error("Este teste só aceita o banco isolado erp_test na porta 5442.");
    }
    const root = process.env.ERP_TEST_ROOT;
    if (!root) throw new Error("Falta ERP_TEST_ROOT.");
    const marker = JSON.parse(await fs.readFile(path.join(root, "provenance.json"), "utf8")) as { purpose?: string };
    if (marker.purpose !== "ancorahub-erp-synthetic-tests") throw new Error("Banco sem a marca de teste sintético.");
    process.env.DATABASE_URL = testUrl;
    process.env.SUPABASE_DB_URL = testUrl;
    delete process.env.DATABASE_SSL;
    const shared = await import("@/shared/db");
    db = shared.getDatabase();
    const result = await db.execute(sql`SHOW data_directory`);
    if (path.resolve(String(result[0].data_directory)).toLowerCase() !== path.resolve(root, "data-erp-test").toLowerCase()) {
      throw new Error("Diretório de dados inesperado.");
    }
    // A migration 0239, só no banco isolado.
    await db.execute(sql.raw(await fs.readFile(path.resolve("drizzle/0239_duty_presence_photo.sql"), "utf8")));
    (await import("./duty-photo-setting")).resetDutyPhotoSettingCache();
  });

  it("presencial sem foto confirma com um toque; online com foto exige a foto; sem escolha segue a modalidade", async () => {
    if (!db) throw new Error("Banco de teste não iniciado.");
    const { resolveOwnDutyOccurrence, confirmOwnDutyPresence } = await import("./duty-presence");
    const { saveSchedulePhotoRequirement } = await import("./duty-photo-setting");
    const tenantId = randomUUID();
    const branchId = randomUUID();
    const brokerId = randomUUID();
    const scheduleIds = { presencialSemFoto: randomUUID(), onlineComFoto: randomUUID(), presencialPadrao: randomUUID(), onlinePadrao: randomUUID() };
    const assignmentOf = (scheduleId: string) => `a-${scheduleId}`;
    try {
      await db.insert(schema.tenants).values({ id: tenantId, name: "Empresa sintética", slug: `foto-${tenantId}` });
      await db.insert(schema.user).values({ id: brokerId, name: "Corretor Sintético", email: `${brokerId}@example.test` });
      await db.insert(schema.branches).values({ id: branchId, tenantId, name: "Unidade sintética" });
      const modes: Record<keyof typeof scheduleIds, "online" | "presencial"> = { presencialSemFoto: "presencial", onlineComFoto: "online", presencialPadrao: "presencial", onlinePadrao: "online" };
      for (const [key, id] of Object.entries(scheduleIds) as [keyof typeof scheduleIds, string][]) {
        await db.insert(schema.unitDutySchedules).values({ id, tenantId, name: `Plantão ${key}`, dayOfWeek: 3, startsAt: "14:10", endsAt: "18:00", attendanceMode: modes[key], validFrom: new Date("2026-11-01T03:00:00Z"), createdBy: brokerId });
        await db.insert(schema.dutyRosterAssignments).values({ id: assignmentOf(id), tenantId, branchId, scheduleId: id, brokerId, dayOfWeek: 3, startsAt: "14:10", endsAt: "18:00", validFrom: new Date("2026-11-01T03:00:00Z"), createdBy: brokerId, updatedBy: brokerId, createdAt: new Date("2026-11-20T12:00:00Z") });
      }
      expect(await saveSchedulePhotoRequirement(db, { tenantId, scheduleIds: [scheduleIds.presencialSemFoto], value: false })).toBe(true);
      expect(await saveSchedulePhotoRequirement(db, { tenantId, scheduleIds: [scheduleIds.onlineComFoto], value: true })).toBe(true);

      const resolve = async (scheduleId: string) => {
        const result = await resolveOwnDutyOccurrence({ tenantId, brokerId, assignmentId: assignmentOf(scheduleId), now });
        if (!result.ok) throw new Error(`occurrence ${result.reason}`);
        return result.occurrence;
      };

      const semFoto = await resolve(scheduleIds.presencialSemFoto);
      expect(semFoto.mode).toBe("online");
      expect(await confirmOwnDutyPresence({ tenantId, brokerId, occurrence: semFoto, photoStorageKey: null, now })).toMatchObject({ ok: true, awaitingRelease: false });

      const comFoto = await resolve(scheduleIds.onlineComFoto);
      expect(comFoto.mode).toBe("presencial");
      expect(await confirmOwnDutyPresence({ tenantId, brokerId, occurrence: comFoto, photoStorageKey: null, now })).toEqual({ ok: false, reason: "photo_required" });

      expect((await resolve(scheduleIds.presencialPadrao)).mode).toBe("presencial");
      expect((await resolve(scheduleIds.onlinePadrao)).mode).toBe("online");
    } finally {
      await db.delete(schema.auditLogs).where(eq(schema.auditLogs.userId, brokerId));
      await db.delete(schema.dutyPresenceConfirmations).where(eq(schema.dutyPresenceConfirmations.tenantId, tenantId));
      await db.delete(schema.dutyRosterAssignments).where(eq(schema.dutyRosterAssignments.tenantId, tenantId));
      await db.delete(schema.unitDutySchedules).where(inArray(schema.unitDutySchedules.id, Object.values(scheduleIds)));
      await db.delete(schema.branches).where(eq(schema.branches.id, branchId));
      await db.delete(schema.user).where(eq(schema.user.id, brokerId));
      await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
    }
  }, 60_000);
});

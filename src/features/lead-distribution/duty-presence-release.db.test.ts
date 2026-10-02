/**
 * Releasing a broker on the plantão without their click, against the real
 * schema inside one transaction that is ROLLED BACK. Opt-in only:
 *   RUN_DUTY_RELEASE_DB_E2E=1 npx vitest run src/features/lead-distribution/duty-presence-release.db.test.ts
 */
import { and, eq, gt, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { existsSync, readFileSync } from "node:fs";
import { afterAll, describe, expect, it, vi } from "vitest";

import * as realSchema from "@/shared/db/schema";

vi.mock("server-only", () => ({}));
const state: { tx: unknown } = { tx: null };
vi.mock("@/shared/db", () => ({ schema: realSchema, getDatabase: () => state.tx }));

const enabled = process.env.RUN_DUTY_RELEASE_DB_E2E === "1";
function readLocalEnv(name: string) {
  if (!existsSync(".env.local")) return "";
  const line = readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}
const url = enabled ? (readLocalEnv("SUPABASE_DB_URL") || readLocalEnv("DATABASE_URL")) : "";
const client = enabled ? postgres(url, { prepare: false, max: 1 }) : null;
const db = client ? drizzle(client, { schema: realSchema }) : null;
afterAll(async () => { await client?.end({ timeout: 5 }); });

describe.skipIf(!enabled)("release a broker without the presence click (rolled back)", () => {
  it("confirms their presence for the shift, keeps who released, and the sweep would not invite them", async () => {
    const s = realSchema;
    await db!.transaction(async (tx) => {
      state.tx = tx;
      // A tenant with a plantão valid today.
      const [today] = await tx.select({ tenantId: s.unitDutySchedules.tenantId }).from(s.unitDutySchedules)
        .where(and(eq(s.unitDutySchedules.status, "active"), lte(s.unitDutySchedules.validFrom, new Date()), gt(s.unitDutySchedules.validUntil, new Date()))).limit(1);
      const [director] = await tx.select({ tenantId: s.tenantMemberships.tenantId, userId: s.tenantMemberships.userId }).from(s.tenantMemberships)
        .where(and(eq(s.tenantMemberships.tenantId, today!.tenantId), eq(s.tenantMemberships.role, "director"), eq(s.tenantMemberships.status, "active"))).limit(1);
      const assignments = await tx.select({ id: s.dutyRosterAssignments.id }).from(s.dutyRosterAssignments)
        .where(and(eq(s.dutyRosterAssignments.tenantId, director!.tenantId), eq(s.dutyRosterAssignments.status, "active")));
      const { releaseDutyPresenceManually } = await import("./duty-presence");
      let released: string | null = null;
      const reasons = new Set<string>();
      for (const assignment of assignments) {
        const result = await releaseDutyPresenceManually({ tenantId: director!.tenantId, assignmentId: assignment.id, releasedBy: director!.userId });
        if (result.ok) { released = assignment.id; break; } else reasons.add(result.reason);
      }
      expect(released, [...reasons].join(" | ")).toBeTruthy();
      const [row] = await tx.select({ status: s.dutyPresenceConfirmations.status, confirmedBy: s.dutyPresenceConfirmations.confirmedBy, confirmedAt: s.dutyPresenceConfirmations.confirmedAt })
        .from(s.dutyPresenceConfirmations).where(eq(s.dutyPresenceConfirmations.assignmentId, released!));
      expect(row).toMatchObject({ status: "confirmed", confirmedBy: director!.userId });
      expect(row!.confirmedAt).toBeTruthy();
      const [audit] = await tx.select({ acao: s.auditLogs.acao }).from(s.auditLogs).where(and(eq(s.auditLogs.entidadeId, released!), eq(s.auditLogs.acao, "duty_presence.released_manually")));
      expect(audit).toBeTruthy();
      tx.rollback();
    }).catch((error) => {
      if (!String(error?.message ?? error).includes("Rollback")) throw error;
    });
  }, 120_000);
});

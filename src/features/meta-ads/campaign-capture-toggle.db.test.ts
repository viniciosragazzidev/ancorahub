/**
 * "Pausar captura" / "Capturar leads" of a campaign against the real schema,
 * inside one transaction that is ROLLED BACK. Opt-in only:
 *   RUN_CAMPAIGN_CAPTURE_DB_E2E=1 npx vitest run src/features/meta-ads/campaign-capture-toggle.db.test.ts
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { afterAll, describe, expect, it, vi } from "vitest";

import * as realSchema from "@/shared/db/schema";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const state: { tx: unknown; context: unknown } = { tx: null, context: null };
vi.mock("@/shared/db", () => ({ schema: realSchema, getDatabase: () => state.tx }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));

const enabled = process.env.RUN_CAMPAIGN_CAPTURE_DB_E2E === "1";
function readLocalEnv(name: string) {
  if (!existsSync(".env.local")) return "";
  const line = readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}
const url = enabled ? (readLocalEnv("SUPABASE_DB_URL") || readLocalEnv("DATABASE_URL")) : "";
const client = enabled ? postgres(url, { prepare: false, max: 1 }) : null;
const db = client ? drizzle(client, { schema: realSchema }) : null;
afterAll(async () => { await client?.end({ timeout: 5 }); });

describe.skipIf(!enabled)("campaign capture toggle (rolled back)", () => {
  it("pausing removes the per-ad copies, keeps an ad sent on purpose to a queue, and enabling creates no copies", async () => {
    const s = realSchema;
    await db!.transaction(async (tx) => {
      state.tx = tx;
      // A campaign with at least two ads, and a director and an active queue of the tenant.
      const [pick] = await tx.select({ tenantId: s.metaAds.tenantId, campaignId: s.metaAdSets.campaignId })
        .from(s.metaAds)
        .innerJoin(s.metaAdSets, and(eq(s.metaAdSets.tenantId, s.metaAds.tenantId), eq(s.metaAdSets.adSetId, s.metaAds.adSetId)))
        .where(eq(s.metaAdSets.campaignId, "120249098837250599"))
        .limit(1);
      expect(pick).toBeTruthy();
      const [director] = await tx.select({ userId: s.tenantMemberships.userId }).from(s.tenantMemberships)
        .where(and(eq(s.tenantMemberships.tenantId, pick!.tenantId), eq(s.tenantMemberships.role, "director"), eq(s.tenantMemberships.status, "active"))).limit(1);
      const [queue] = await tx.select({ id: s.leadQueues.id }).from(s.leadQueues).where(and(eq(s.leadQueues.tenantId, pick!.tenantId), eq(s.leadQueues.status, "active"))).limit(1);
      state.context = { userId: director!.userId, tenantId: pick!.tenantId, role: "director", jobTitle: "director", branchId: null };
      const adIds = (await tx.select({ adId: s.metaAds.adId }).from(s.metaAds)
        .innerJoin(s.metaAdSets, and(eq(s.metaAdSets.tenantId, s.metaAds.tenantId), eq(s.metaAdSets.adSetId, s.metaAds.adSetId)))
        .where(and(eq(s.metaAds.tenantId, pick!.tenantId), eq(s.metaAdSets.campaignId, pick!.campaignId)))).map((row) => row.adId);
      expect(adIds.length).toBeGreaterThan(1);

      // Copies "capturar, sem fila" on every ad, and one ad sent on purpose to a queue.
      await tx.delete(s.metaAdQueueRoutes).where(and(eq(s.metaAdQueueRoutes.tenantId, pick!.tenantId), inArray(s.metaAdQueueRoutes.adId, adIds)));
      await tx.insert(s.metaAdQueueRoutes).values(adIds.map((adId, index) => ({
        id: randomUUID(), tenantId: pick!.tenantId, adId, queueId: index === 0 ? queue!.id : null, enabled: true, createdBy: director!.userId,
      })));
      const routes = async () => tx.select({ adId: s.metaAdQueueRoutes.adId, queueId: s.metaAdQueueRoutes.queueId })
        .from(s.metaAdQueueRoutes).where(and(eq(s.metaAdQueueRoutes.tenantId, pick!.tenantId), inArray(s.metaAdQueueRoutes.adId, adIds)));

      const { toggleMetaCampaignCaptureEligibilityAction } = await import("./actions");
      expect(await toggleMetaCampaignCaptureEligibilityAction({ campaignId: pick!.campaignId, enabled: false })).toEqual({ success: true });
      expect(await routes()).toEqual([{ adId: adIds[0], queueId: queue!.id }]);
      const [campaignRoute] = await tx.select({ enabled: s.metaCampaignQueueRoutes.enabled }).from(s.metaCampaignQueueRoutes)
        .where(and(eq(s.metaCampaignQueueRoutes.tenantId, pick!.tenantId), eq(s.metaCampaignQueueRoutes.campaignId, pick!.campaignId)));
      expect(campaignRoute!.enabled).toBe(false);

      // Turning capture on with no active queue is refused: leads would arrive with no queue.
      const inactiveQueueId = randomUUID();
      await tx.insert(s.leadQueues).values({ id: inactiveQueueId, tenantId: pick!.tenantId, name: "Fila teste desativada", slug: `fila-teste-${inactiveQueueId}`, status: "inactive" });
      await tx.update(s.metaCampaignQueueRoutes).set({ queueId: inactiveQueueId })
        .where(and(eq(s.metaCampaignQueueRoutes.tenantId, pick!.tenantId), eq(s.metaCampaignQueueRoutes.campaignId, pick!.campaignId)));
      const refused = await toggleMetaCampaignCaptureEligibilityAction({ campaignId: pick!.campaignId, enabled: true });
      expect(refused.success).toBe(false);
      expect(refused.error).toContain("Fila teste desativada");
      await tx.update(s.metaCampaignQueueRoutes).set({ queueId: null })
        .where(and(eq(s.metaCampaignQueueRoutes.tenantId, pick!.tenantId), eq(s.metaCampaignQueueRoutes.campaignId, pick!.campaignId)));
      expect((await toggleMetaCampaignCaptureEligibilityAction({ campaignId: pick!.campaignId, enabled: true })).error).toContain("não tem fila");

      await tx.update(s.metaCampaignQueueRoutes).set({ queueId: queue!.id })
        .where(and(eq(s.metaCampaignQueueRoutes.tenantId, pick!.tenantId), eq(s.metaCampaignQueueRoutes.campaignId, pick!.campaignId)));
      expect(await toggleMetaCampaignCaptureEligibilityAction({ campaignId: pick!.campaignId, enabled: true })).toEqual({ success: true });
      expect((await routes()).filter((route) => route.queueId === null)).toEqual([]);
      const copies = await tx.select({ id: s.metaAdQueueRoutes.id }).from(s.metaAdQueueRoutes)
        .where(and(eq(s.metaAdQueueRoutes.tenantId, pick!.tenantId), inArray(s.metaAdQueueRoutes.adId, adIds), isNull(s.metaAdQueueRoutes.queueId)));
      expect(copies).toHaveLength(0);

      tx.rollback();
    }).catch((error) => {
      if (!String(error?.message ?? error).includes("Rollback")) throw error;
    });
  }, 60_000);
});

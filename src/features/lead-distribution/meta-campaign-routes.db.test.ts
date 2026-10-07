/**
 * Adding a Meta campaign to a queue with and without its ads' own rules,
 * against the real schema inside one transaction that is ROLLED BACK.
 * Opt-in only (never part of the normal suite):
 *   RUN_META_ROUTES_DB_E2E=1 npx vitest run src/features/lead-distribution/meta-campaign-routes.db.test.ts
 */
import { and, eq, ne } from "drizzle-orm";
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

const enabled = process.env.RUN_META_ROUTES_DB_E2E === "1";
function readLocalEnv(name: string) {
  if (!existsSync(".env.local")) return "";
  const line = readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}
const url = enabled ? (readLocalEnv("SUPABASE_DB_URL") || readLocalEnv("DATABASE_URL")) : "";
const client = enabled ? postgres(url, { prepare: false, max: 1 }) : null;
const db = client ? drizzle(client, { schema: realSchema }) : null;
afterAll(async () => { await client?.end({ timeout: 5 }); });

describe.skipIf(!enabled)("campaign route with its ads (rolled back)", () => {
  it("keeps the ads' own rules unless asked to bring them, then every ad follows the campaign", async () => {
    const s = realSchema;
    await db!.transaction(async (tx) => {
      state.tx = tx;
      // A campaign with at least two ads, and an active queue of the same tenant.
      const [pick] = await tx.select({ tenantId: s.metaAds.tenantId, campaignId: s.metaAdSets.campaignId })
        .from(s.metaAds)
        .innerJoin(s.metaAdSets, and(eq(s.metaAdSets.tenantId, s.metaAds.tenantId), eq(s.metaAdSets.adSetId, s.metaAds.adSetId)))
        .innerJoin(s.leadQueues, and(eq(s.leadQueues.tenantId, s.metaAds.tenantId), eq(s.leadQueues.status, "active")))
        .limit(1);
      expect(pick).toBeTruthy();
      const [director] = await tx.select({ userId: s.tenantMemberships.userId }).from(s.tenantMemberships)
        .where(and(eq(s.tenantMemberships.tenantId, pick.tenantId), eq(s.tenantMemberships.role, "director"), eq(s.tenantMemberships.status, "active"))).limit(1);
      const [queue] = await tx.select({ id: s.leadQueues.id }).from(s.leadQueues).where(and(eq(s.leadQueues.tenantId, pick.tenantId), eq(s.leadQueues.status, "active"))).limit(1);
      const context: TenantContext = { userId: director.userId, tenantId: pick.tenantId, role: "director", jobTitle: "director", branchId: null };
      const ads = await tx.select({ adId: s.metaAds.adId }).from(s.metaAds)
        .innerJoin(s.metaAdSets, and(eq(s.metaAdSets.tenantId, s.metaAds.tenantId), eq(s.metaAdSets.adSetId, s.metaAds.adSetId)))
        .where(and(eq(s.metaAds.tenantId, pick.tenantId), eq(s.metaAdSets.campaignId, pick.campaignId)));
      const adIds = ads.map((ad) => ad.adId);

      // Start clean: no campaign route, and one ad with its own "do not register" rule.
      await tx.delete(s.metaCampaignQueueRoutes).where(and(eq(s.metaCampaignQueueRoutes.tenantId, pick.tenantId), eq(s.metaCampaignQueueRoutes.campaignId, pick.campaignId)));
      await tx.insert(s.metaAdQueueRoutes).values({ id: randomUUID(), tenantId: pick.tenantId, adId: adIds[0]!, queueId: null, enabled: false, createdBy: director.userId })
        .onConflictDoUpdate({ target: [s.metaAdQueueRoutes.tenantId, s.metaAdQueueRoutes.adId], set: { queueId: null, enabled: false } });
      const ownRules = async () => (await tx.select({ adId: s.metaAdQueueRoutes.adId }).from(s.metaAdQueueRoutes).where(eq(s.metaAdQueueRoutes.tenantId, pick.tenantId)))
        .filter((row) => adIds.includes(row.adId)).length;

      const { saveMetaCampaignQueueRoute } = await import("./control-service");
      const kept = await saveMetaCampaignQueueRoute(context, { campaignId: pick.campaignId, queueId: queue.id, enabled: true });
      expect(kept.adsBrought).toBeGreaterThan(0);
      expect(await ownRules()).toBe(0);

      const brought = await saveMetaCampaignQueueRoute(context, { campaignId: pick.campaignId, queueId: queue.id, enabled: true, includeAds: true });
      expect(brought.adsBrought).toBe(0);
      expect(await ownRules()).toBe(0);

      // Choosing another queue moves the campaign (it used to be refused) and the move is audited.
      const [other] = await tx.select({ id: s.leadQueues.id }).from(s.leadQueues)
        .where(and(eq(s.leadQueues.tenantId, pick.tenantId), eq(s.leadQueues.status, "active"), ne(s.leadQueues.id, queue.id))).limit(1);
      expect(other).toBeTruthy();
      const moved = await saveMetaCampaignQueueRoute(context, { campaignId: pick.campaignId, queueId: other.id, enabled: true });
      expect(moved.queueId).toBe(other.id);
      const [audit] = await tx.select({ acao: s.auditLogs.acao }).from(s.auditLogs)
        .where(and(eq(s.auditLogs.entidadeId, pick.campaignId), eq(s.auditLogs.acao, `meta_campaign_queue_route.moved_from:${queue.id}`)));
      expect(audit).toBeTruthy();

      // An ad never goes to a queue other than its campaign's.
      const { saveMetaAdQueueRoute } = await import("./control-service");
      await expect(saveMetaAdQueueRoute(context, { adId: adIds[0]!, queueId: queue.id, enabled: true }))
        .rejects.toThrow(/fila diferente da sua campanha/);
      // An ad already sent elsewhere is brought back when the campaign gets its queue.
      await tx.insert(s.metaAdQueueRoutes).values({ id: randomUUID(), tenantId: pick.tenantId, adId: adIds[0]!, queueId: queue.id, enabled: true, createdBy: director.userId })
        .onConflictDoUpdate({ target: [s.metaAdQueueRoutes.tenantId, s.metaAdQueueRoutes.adId], set: { queueId: queue.id, enabled: true } });
      const resaved = await saveMetaCampaignQueueRoute(context, { campaignId: pick.campaignId, queueId: other.id, enabled: true });
      expect(resaved.adsBrought).toBe(1);
      expect(await ownRules()).toBe(0);

      tx.rollback();
    }).catch((error) => {
      if (!String(error?.message ?? error).includes("Rollback")) throw error;
    });
  }, 60_000);
});

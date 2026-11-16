import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/shared/db/schema";
import { claimPendingInvitation } from "./invitation-accept-claim";

const testUrl = process.env.ERP_TEST_DATABASE_URL;
let db: ReturnType<typeof import("@/shared/db").getDatabase> | null = null;
afterAll(async () => { await db?.$client.end({ timeout: 5 }); });

describe.skipIf(!testUrl)("invitation acceptance against isolated PostgreSQL", () => {
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

  it("accepts a pending invitation once under two simultaneous calls", async () => {
    if (!db) throw new Error("Isolated test database was not initialized.");
    const tenantId = randomUUID();
    const branchId = randomUUID();
    const userId = randomUUID();
    const profileId = randomUUID();
    const invitationId = randomUUID();
    const now = new Date();
    let ready = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const attempt = (email: string) => (async () => {
      ready += 1;
      if (ready === 2) release();
      await barrier;
      return db!.transaction((tx) => claimPendingInvitation(tx, { id: invitationId, tenantId, email, now }));
    })();

    try {
      await db.insert(schema.tenants).values({ id: tenantId, name: "Empresa sintética", slug: `race-${tenantId}` });
      await db.insert(schema.branches).values({ id: branchId, tenantId, name: "Unidade sintética" });
      await db.insert(schema.user).values({ id: userId, name: "Gestor sintético", email: `manager-${userId}@example.invalid` });
      await db.insert(schema.brokerProfiles).values({ id: profileId, tenantId, branchId, internalCode: `race-${profileId}`, professionalName: "Pessoa sintética", phone: "5511999999999" });
      await db.insert(schema.brokerInvitations).values({ id: invitationId, tenantId, branchId, brokerProfileId: profileId, tokenHash: randomUUID(), expiresAt: new Date(now.getTime() + 60_000), status: "PENDING" });

      const results = await Promise.all([attempt(`a-${invitationId}@example.invalid`), attempt(`b-${invitationId}@example.invalid`)]);
      expect(results.filter(Boolean)).toHaveLength(1);
      const [saved] = await db.select({ status: schema.brokerInvitations.status }).from(schema.brokerInvitations)
        .where(and(eq(schema.brokerInvitations.id, invitationId), eq(schema.brokerInvitations.tenantId, tenantId)));
      expect(saved.status).toBe("ACCEPTED");
    } finally {
      await db.delete(schema.brokerInvitations).where(eq(schema.brokerInvitations.tenantId, tenantId));
      await db.delete(schema.brokerProfiles).where(eq(schema.brokerProfiles.tenantId, tenantId));
      await db.delete(schema.user).where(eq(schema.user.id, userId));
      await db.delete(schema.branches).where(eq(schema.branches.tenantId, tenantId));
      await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
    }
  }, 30_000);
});

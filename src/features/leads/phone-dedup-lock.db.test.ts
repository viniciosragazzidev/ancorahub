import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/shared/db/schema";
import { lockLeadCreationByPhone } from "./phone-dedup-lock";

const testUrl = process.env.ERP_TEST_DATABASE_URL;
let db: ReturnType<typeof import("@/shared/db").getDatabase> | null = null;

afterAll(async () => { await db?.$client.end({ timeout: 5 }); });

describe.skipIf(!testUrl)("lead phone advisory lock against isolated PostgreSQL", () => {
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

  it("serializes concurrent tenant-and-phone intake and inserts only one lead", async () => {
    if (!db) throw new Error("Isolated test database was not initialized.");
    const tenantId = randomUUID();
    const phone = `55${tenantId.replace(/\D/g, "").slice(0, 11).padEnd(11, "8")}`;
    const phoneKey = phone.slice(-8);
    let arrived = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const attempt = () => (async () => {
      arrived += 1;
      if (arrived === 2) release();
      await barrier;
      return db!.transaction(async (tx) => {
        await lockLeadCreationByPhone(tx, tenantId, phone);
        const [existing] = await tx.select({ id: schema.leads.id }).from(schema.leads)
          .where(and(
            eq(schema.leads.tenantId, tenantId),
            isNull(schema.leads.deletedAt),
            sql`right(regexp_replace(${schema.leads.telefone}, '[^0-9]', '', 'g'), 8) = ${phoneKey}`,
          )).limit(1);
        if (existing) return false;
        await tx.insert(schema.leads).values({ id: randomUUID(), tenantId, nome: "Lead sintético", telefone: phone });
        return true;
      });
    })();

    try {
      await db.insert(schema.tenants).values({ id: tenantId, name: "Tenant sintético", slug: `race-${tenantId}` });
      const results = await Promise.all([attempt(), attempt()]);
      expect(results.filter(Boolean)).toHaveLength(1);
      const saved = await db.select({ id: schema.leads.id }).from(schema.leads).where(eq(schema.leads.tenantId, tenantId));
      expect(saved).toHaveLength(1);
    } finally {
      await db.delete(schema.leads).where(eq(schema.leads.tenantId, tenantId));
      await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
    }
  }, 30_000);
});

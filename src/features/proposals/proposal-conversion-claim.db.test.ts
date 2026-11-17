import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/shared/db/schema";
import type { DatabaseExecutor } from "@/shared/db";
import { lockLeadAndFindActiveSale } from "@/features/leads/lead-sale-lock";
import { claimProposalConversion, completeProposalConversion } from "./proposal-conversion-claim";

const testUrl = process.env.ERP_TEST_DATABASE_URL;
let db: ReturnType<typeof import("@/shared/db").getDatabase> | null = null;

afterAll(async () => { await db?.$client.end({ timeout: 5 }); });

function createBarrier(parties: number) {
  let arrived = 0;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  return async () => {
    arrived += 1;
    if (arrived === parties) release();
    await waiting;
  };
}

describe.skipIf(!testUrl)("proposal sale conversion against isolated PostgreSQL", () => {
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

  async function createFixture() {
    if (!db) throw new Error("Isolated test database was not initialized.");
    const tenantId = randomUUID();
    const userId = randomUUID();
    const leadId = randomUUID();
    const proposalId = randomUUID();
    const now = new Date();
    await db.insert(schema.tenants).values({ id: tenantId, name: "Tenant sintético", slug: `race-${tenantId}` });
    await db.insert(schema.user).values({ id: userId, name: "Corretor sintético", email: `${userId}@example.test` });
    await db.insert(schema.leads).values({ id: leadId, tenantId, nome: "Lead sintético", telefone: "211234567" });
    await db.insert(schema.proposals).values({
      id: proposalId, tenantId, leadId, title: "Proposta sintética", status: "aprovada", validUntil: new Date(now.getTime() + 86_400_000),
      createdBy: userId, leadName: "Lead sintético",
    });
    return { tenantId, userId, leadId, proposalId, now };
  }

  async function insertSale(tx: DatabaseExecutor, values: { tenantId: string; userId: string; leadId: string; saleId: string; now: Date }) {
    await tx.insert(schema.sales).values({
      id: values.saleId, tenantId: values.tenantId, leadId: values.leadId, brokerId: values.userId,
      saleDate: values.now, saleValue: "100.00", status: "active", createdBy: values.userId,
    });
  }

  async function convertProposal(fixture: Awaited<ReturnType<typeof createFixture>>, saleId: string) {
    if (!db) throw new Error("Isolated test database was not initialized.");
    return db.transaction(async (tx) => {
      const claim = await claimProposalConversion(tx, {
        tenantId: fixture.tenantId, leadId: fixture.leadId, proposalId: fixture.proposalId, convertedAt: fixture.now,
      });
      if (claim.kind !== "claimed") return claim.kind;
      await insertSale(tx, { tenantId: fixture.tenantId, userId: fixture.userId, leadId: fixture.leadId, saleId, now: fixture.now });
      const linked = await completeProposalConversion(tx, {
        tenantId: fixture.tenantId, leadId: fixture.leadId, proposalId: fixture.proposalId, saleId, convertedAt: fixture.now,
      });
      if (!linked) throw new Error("Proposal finalization lost its conditional update.");
      return claim.kind;
    });
  }

  async function cleanup(fixture: Awaited<ReturnType<typeof createFixture>>) {
    if (!db) return;
    await db.delete(schema.sales).where(and(eq(schema.sales.tenantId, fixture.tenantId), eq(schema.sales.leadId, fixture.leadId)));
    await db.delete(schema.proposals).where(eq(schema.proposals.id, fixture.proposalId));
    await db.delete(schema.leads).where(eq(schema.leads.id, fixture.leadId));
    await db.delete(schema.user).where(eq(schema.user.id, fixture.userId));
    await db.delete(schema.tenants).where(eq(schema.tenants.id, fixture.tenantId));
  }

  it("two simultaneous conversions of one proposal create one sale and return the winning sale", async () => {
    if (!db) throw new Error("Isolated test database was not initialized.");
    const fixture = await createFixture();
    const barrier = createBarrier(2);
    try {
      const results = await Promise.all(["sale-a", "sale-b"].map(async (saleId) => {
        await barrier();
        return convertProposal(fixture, saleId);
      }));
      expect(results.filter((kind) => kind === "claimed")).toHaveLength(1);
      expect(results.filter((kind) => kind === "already_converted")).toHaveLength(1);
      const sales = await db.select({ id: schema.sales.id }).from(schema.sales)
        .where(and(eq(schema.sales.tenantId, fixture.tenantId), eq(schema.sales.leadId, fixture.leadId), eq(schema.sales.status, "active")));
      const [proposal] = await db.select({ convertedSaleId: schema.proposals.convertedSaleId }).from(schema.proposals)
        .where(eq(schema.proposals.id, fixture.proposalId));
      expect(sales).toHaveLength(1);
      expect(proposal?.convertedSaleId).toBe(sales[0]?.id);
    } finally {
      await cleanup(fixture);
    }
  }, 30_000);

  it("proposal conversion and register-sale transaction cannot create two active sales", async () => {
    if (!db) throw new Error("Isolated test database was not initialized.");
    const fixture = await createFixture();
    const barrier = createBarrier(2);
    try {
      const proposalAttempt = (async () => {
        await barrier();
        return convertProposal(fixture, "proposal-sale");
      })();
      const registrationAttempt = (async () => {
        await barrier();
        return db!.transaction(async (tx) => {
          const slot = await lockLeadAndFindActiveSale(tx, { tenantId: fixture.tenantId, leadId: fixture.leadId });
          if (!slot.lead) return "lead_not_found";
          if (slot.activeSaleId) return "already_registered";
          await insertSale(tx, { tenantId: fixture.tenantId, userId: fixture.userId, leadId: fixture.leadId, saleId: "register-sale", now: fixture.now });
          return "registered";
        });
      })();

      const results = await Promise.all([proposalAttempt, registrationAttempt]);
      expect(results.filter((kind) => kind === "claimed" || kind === "registered")).toHaveLength(1);
      expect(results.filter((kind) => kind === "sale_exists" || kind === "already_registered")).toHaveLength(1);
      const sales = await db.select({ id: schema.sales.id }).from(schema.sales)
        .where(and(eq(schema.sales.tenantId, fixture.tenantId), eq(schema.sales.leadId, fixture.leadId), eq(schema.sales.status, "active")));
      expect(sales).toHaveLength(1);
    } finally {
      await cleanup(fixture);
    }
  }, 30_000);
});

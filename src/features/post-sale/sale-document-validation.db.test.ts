import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/shared/db/schema";
import { lockSaleEvidence, saleEvidenceIssue } from "./sale-document-validation";

const testUrl = process.env.ERP_TEST_DATABASE_URL;
let db: ReturnType<typeof import("@/shared/db").getDatabase> | null = null;
afterAll(async () => { await db?.$client.end({ timeout: 5 }); });

describe.skipIf(!testUrl)("sale evidence row lock against isolated PostgreSQL", () => {
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

  it("sale validation waits for a concurrent removal and refuses removed evidence", async () => {
    if (!db) throw new Error("Isolated test database was not initialized.");
    const tenantId = randomUUID();
    const userId = randomUUID();
    const leadId = randomUUID();
    const requirementId = randomUUID();
    const holderId = randomUUID();
    const confirmationId = randomUUID();
    let removalLocked!: () => void;
    let saleQueryStarted!: () => void;
    let releaseRemoval!: () => void;
    const locked = new Promise<void>((resolve) => { removalLocked = resolve; });
    const saleStarted = new Promise<void>((resolve) => { saleQueryStarted = resolve; });
    const resumeRemoval = new Promise<void>((resolve) => { releaseRemoval = resolve; });

    try {
      await db.insert(schema.tenants).values({ id: tenantId, name: "Empresa sintética", slug: `race-${tenantId}` });
      await db.insert(schema.user).values({ id: userId, name: "Pessoa sintética", email: `race-${userId}@example.invalid` });
      await db.insert(schema.leads).values({ id: leadId, tenantId, nome: "Lead sintético", telefone: "5511999999999" });
      await db.insert(schema.documentRequirements).values({ id: requirementId, tenantId, name: "Identidade", required: true, appliesPerBeneficiary: true });
      await db.insert(schema.leadBeneficiaries).values({ id: holderId, tenantId, leadId, name: "Titular", isHolder: true });
      await db.insert(schema.leadDocuments).values([
        { id: confirmationId, tenantId, leadId, filename: "confirmacao.pdf", fileUrl: "private/test", uploadedBy: userId, status: "approved" },
        { id: randomUUID(), tenantId, leadId, requirementId, beneficiaryId: holderId, filename: "identidade.pdf", fileUrl: "private/test", uploadedBy: userId, status: "approved" },
      ]);

      const removal = db.transaction(async (tx) => {
        const [row] = await tx.update(schema.leadDocuments).set({ deletedAt: new Date(), deletedBy: userId })
          .where(and(eq(schema.leadDocuments.tenantId, tenantId), eq(schema.leadDocuments.id, confirmationId), isNull(schema.leadDocuments.deletedAt)))
          .returning({ id: schema.leadDocuments.id });
        removalLocked();
        await resumeRemoval;
        return row?.id ?? null;
      });
      await locked;

      const saleValidation = db.transaction(async (tx) => {
        saleQueryStarted();
        const evidence = await lockSaleEvidence(tx, { tenantId, leadId, planId: null, confirmationDocumentId: confirmationId });
        return saleEvidenceIssue(evidence);
      });
      await saleStarted;
      releaseRemoval();

      const [removedId, issue] = await Promise.all([removal, saleValidation]);
      expect(removedId).toBe(confirmationId);
      expect(issue).toBe("confirmation");
    } finally {
      await db.delete(schema.leadDocuments).where(eq(schema.leadDocuments.tenantId, tenantId));
      await db.delete(schema.leadBeneficiaries).where(eq(schema.leadBeneficiaries.tenantId, tenantId));
      await db.delete(schema.documentRequirements).where(eq(schema.documentRequirements.tenantId, tenantId));
      await db.delete(schema.leads).where(eq(schema.leads.tenantId, tenantId));
      await db.delete(schema.user).where(eq(schema.user.id, userId));
      await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
    }
  }, 30_000);
});

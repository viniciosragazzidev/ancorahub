import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/shared/db/schema";

const testUrl = process.env.ERP_TEST_DATABASE_URL;
let db: ReturnType<typeof import("@/shared/db").getDatabase> | null = null;
let listLeadObservations: typeof import("./lead-observations").listLeadObservations;
afterAll(async () => { await db?.$client.end({ timeout: 5 }); });

describe.skipIf(!testUrl)("escopo do histórico de observações (PostgreSQL isolado)", () => {
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
    ({ listLeadObservations } = await import("./lead-observations"));
  });

  it("mostra só ao corretor responsável, na mesma empresa, da mais nova para a mais antiga", async () => {
    if (!db) throw new Error("Banco de teste não iniciado.");
    const tenantId = randomUUID();
    const otherTenantId = randomUUID();
    const owner = randomUUID();
    const colleague = randomUUID();
    const leadId = randomUUID();
    const foreignLeadId = randomUUID();
    const phone = (seed: string) => `55${seed.replace(/\D/g, "").slice(0, 11).padEnd(11, "7")}`;
    try {
      await db.insert(schema.tenants).values([
        { id: tenantId, name: "Empresa sintética", slug: `obs-${tenantId}` },
        { id: otherTenantId, name: "Outra empresa sintética", slug: `obs-${otherTenantId}` },
      ]);
      await db.insert(schema.user).values([
        { id: owner, name: "Corretor Dono", email: `${owner}@example.test` },
        { id: colleague, name: "Corretor Colega", email: `${colleague}@example.test` },
      ]);
      await db.insert(schema.leads).values([
        { id: leadId, tenantId, nome: "Lead sintético", telefone: phone(leadId), corretorId: owner, status: "negotiation" },
        { id: foreignLeadId, tenantId: otherTenantId, nome: "Lead de outra empresa", telefone: phone(foreignLeadId), corretorId: owner, status: "contacted" },
      ]);
      await db.insert(schema.leadInteractions).values([
        { id: randomUUID(), leadId, userId: owner, tipo: "status_change", conteudo: "Novo contato registrado. Como foi o contato: Primeira conversa", metadata: { observation: "Primeira conversa", fromStatus: "in_contact", toStatus: "contacted" }, createdAt: new Date("2026-11-20T10:00:00Z") },
        { id: randomUUID(), leadId, userId: colleague, tipo: "status_change", conteudo: "Status alterado: Entrei em contato → Em negociação. Observação: Pediu coparticipação", createdAt: new Date("2026-11-21T10:00:00Z") },
        { id: randomUUID(), leadId, userId: owner, tipo: "status_change", conteudo: "Status alterado: Em negociação → Cotação enviada.", createdAt: new Date("2026-11-22T10:00:00Z") },
        { id: randomUUID(), leadId, userId: owner, tipo: "note", conteudo: "Observação: nota solta, não é etapa", createdAt: new Date("2026-11-23T10:00:00Z") },
        { id: randomUUID(), leadId: foreignLeadId, userId: owner, tipo: "status_change", conteudo: "x", metadata: { observation: "De outra empresa", toStatus: "contacted" } },
      ]);

      const mine = await listLeadObservations({ tenantId, userId: owner }, leadId);
      expect(mine.map((item) => item.observation)).toEqual(["Pediu coparticipação", "Primeira conversa"]);
      expect(mine[0]).toMatchObject({ authorName: "Corretor Colega", stageText: "Em negociação" });
      expect(mine[1]).toMatchObject({ authorName: "Corretor Dono", toStatus: "contacted" });

      // Outro corretor da mesma empresa não vê; a empresa errada não vê; o lead de outra empresa não vaza.
      expect(await listLeadObservations({ tenantId, userId: colleague }, leadId)).toEqual([]);
      expect(await listLeadObservations({ tenantId: otherTenantId, userId: owner }, leadId)).toEqual([]);
      expect(await listLeadObservations({ tenantId, userId: owner }, foreignLeadId)).toEqual([]);

      // Lead apagado sai do histórico.
      await db.update(schema.leads).set({ deletedAt: new Date() }).where(eq(schema.leads.id, leadId));
      expect(await listLeadObservations({ tenantId, userId: owner }, leadId)).toEqual([]);
    } finally {
      await db.delete(schema.leadInteractions).where(inArray(schema.leadInteractions.leadId, [leadId, foreignLeadId]));
      await db.delete(schema.leads).where(inArray(schema.leads.id, [leadId, foreignLeadId]));
      await db.delete(schema.user).where(inArray(schema.user.id, [owner, colleague]));
      await db.delete(schema.tenants).where(inArray(schema.tenants.id, [tenantId, otherTenantId]));
    }
  }, 30_000);
});

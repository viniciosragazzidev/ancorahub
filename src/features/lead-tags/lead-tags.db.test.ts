/**
 * Lead tags against the real schema inside one transaction that is ROLLED
 * BACK. Opt-in only (the 0176 migration must be applied):
 *   RUN_LEAD_TAGS_DB_E2E=1 npx vitest run src/features/lead-tags/lead-tags.db.test.ts
 */
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { existsSync, readFileSync } from "node:fs";
import { afterAll, describe, expect, it, vi } from "vitest";

import * as realSchema from "@/shared/db/schema";
import type { TenantContext } from "@/shared/auth/types";

vi.mock("server-only", () => ({}));
const state: { tx: unknown } = { tx: null };
vi.mock("@/shared/db", () => ({ schema: realSchema, getDatabase: () => state.tx }));

const enabled = process.env.RUN_LEAD_TAGS_DB_E2E === "1";
function readLocalEnv(name: string) {
  if (!existsSync(".env.local")) return "";
  const line = readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}
const url = enabled ? (readLocalEnv("SUPABASE_DB_URL") || readLocalEnv("DATABASE_URL")) : "";
const client = enabled ? postgres(url, { prepare: false, max: 1 }) : null;
const db = client ? drizzle(client, { schema: realSchema }) : null;
afterAll(async () => { await client?.end({ timeout: 5 }); });

describe.skipIf(!enabled)("lead tags (rolled back)", () => {
  it("creates, renames, recolors and deletes tags, and tags a lead", async () => {
    const s = realSchema;
    await db!.transaction(async (tx) => {
      state.tx = tx;
      const [director] = await tx.select({ tenantId: s.tenantMemberships.tenantId, userId: s.tenantMemberships.userId }).from(s.tenantMemberships)
        .where(and(eq(s.tenantMemberships.role, "director"), eq(s.tenantMemberships.status, "active"))).limit(1);
      const context: TenantContext = { userId: director!.userId, tenantId: director!.tenantId, role: "director", jobTitle: "director", branchId: null };
      const [lead] = await tx.select({ id: s.leads.id }).from(s.leads).where(eq(s.leads.tenantId, context.tenantId)).limit(1);
      const service = await import("./service");

      const retornar = await service.createLeadTag(context, { name: " Retornar  amanhã " });
      expect(retornar.name).toBe("Retornar amanhã");
      await expect(service.createLeadTag(context, { name: "retornar AMANHÃ" })).rejects.toThrow(/Já existe/);
      const cotacao = await service.createLeadTag(context, { name: "Cotação enviada", colorHue: 140 });
      expect(cotacao.colorHue).toBe(140);

      expect((await service.setLeadTags(context, { leadId: lead!.id, tagIds: [retornar.id, cotacao.id] })).map((tag) => tag.name).sort())
        .toEqual(["Cotação enviada", "Retornar amanhã"]);
      await service.updateLeadTag(context, { id: retornar.id, name: "Ligar amanhã", colorHue: 20 });
      expect((await service.getLeadTagsByLead(context.tenantId, [lead!.id])).get(lead!.id)?.map((tag) => tag.name)).toEqual(["Cotação enviada", "Ligar amanhã"]);

      await service.deleteLeadTag(context, cotacao.id);
      expect((await service.getLeadTagsByLead(context.tenantId, [lead!.id])).get(lead!.id)?.map((tag) => tag.name)).toEqual(["Ligar amanhã"]);

      const broker = { ...context, role: "broker" as const, jobTitle: "broker" as const, userId: "someone-else" };
      await expect(service.createLeadTag(broker, { name: "x" })).rejects.toThrow(/Diretores e Gestores/);

      tx.rollback();
    }).catch((error) => {
      if (!String(error?.message ?? error).includes("Rollback")) throw error;
    });
  }, 60_000);
});

/**
 * The same person sending a second Meta form (another campaign), against the
 * real schema inside one transaction that is ROLLED BACK. Opt-in only:
 *   RUN_REPEAT_FORM_DB_E2E=1 npx vitest run src/features/leads/webhooks/services/repeat-form.db.test.ts
 */
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { afterAll, describe, expect, it, vi } from "vitest";

import * as realSchema from "@/shared/db/schema";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const state: { tx: unknown } = { tx: null };
vi.mock("@/shared/db", () => ({ schema: realSchema, getDatabase: () => state.tx }));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: async () => null }));
vi.mock("@/features/ai-qualification/service", () => ({ startAiQualificationForLead: vi.fn(async () => ({ started: false })) }));
vi.mock("@/features/attendance-flows/runtime", () => ({ attendanceFlowsEnabled: async () => false, startAttendanceRun: vi.fn() }));
vi.mock("@/features/attendance-flows/handlers", () => ({ flowEffectHandlers: vi.fn() }));
vi.mock("@/features/notifications/send-push-helper", () => ({ notifyLeadArrived: vi.fn(async () => undefined) }));
vi.mock("@/features/communication-channels/service", () => ({
  samePhone: (a: string, b: string) => a.replace(/\D/g, "").slice(-8) === b.replace(/\D/g, "").slice(-8),
}));

const enabled = process.env.RUN_REPEAT_FORM_DB_E2E === "1";
function readLocalEnv(name: string) {
  if (!existsSync(".env.local")) return "";
  const line = readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}
const url = enabled ? (readLocalEnv("SUPABASE_DB_URL") || readLocalEnv("DATABASE_URL")) : "";
const client = enabled ? postgres(url, { prepare: false, max: 1 }) : null;
const db = client ? drizzle(client, { schema: realSchema }) : null;
afterAll(async () => { await client?.end({ timeout: 5 }); });

describe.skipIf(!enabled)("a second form from the same person (rolled back)", () => {
  it("keeps the first origin, notes the new form and moves to its queue while no broker has the lead", async () => {
    const s = realSchema;
    await db!.transaction(async (tx) => {
      state.tx = tx;
      const [director] = await tx.select({ tenantId: s.tenantMemberships.tenantId, userId: s.tenantMemberships.userId }).from(s.tenantMemberships)
        .where(and(eq(s.tenantMemberships.role, "director"), eq(s.tenantMemberships.status, "active"))).limit(1);
      const tenantId = director!.tenantId;
      const queues = await tx.select({ id: s.leadQueues.id }).from(s.leadQueues).where(and(eq(s.leadQueues.tenantId, tenantId), eq(s.leadQueues.status, "active"))).limit(2);
      expect(queues).toHaveLength(2);
      const [credential] = await tx.select({ id: s.leadWebhookCredentials.id }).from(s.leadWebhookCredentials).where(eq(s.leadWebhookCredentials.tenantId, tenantId)).limit(1);
      expect(credential).toBeTruthy();

      const { createLeadFromWebhookSync } = await import("./create-lead-from-webhook-sync");
      const phone = `+5521${String(Date.now()).slice(-9)}`;
      const send = (queueId: string, campaign: string, key: string) => createLeadFromWebhookSync({
        tenantId, branchId: null, queueId, credentialId: credential!.id, createdByUserId: director!.userId,
        payload: { nome: "Lead teste repetido", telefone: phone, email: "", website: "" },
        idempotencyKey: key, skipAiQualification: true,
        requestMetadata: { requestId: key, userAgent: null, receivedAt: new Date() },
        leadSource: { channel: "meta_lead_ads", externalId: key, campaign, ad: `ad-${campaign}`, form: `form-${campaign}`, page: null, capturedAt: new Date(), metadata: { campaignName: `Campanha ${campaign}` } },
      });

      const first = await send(queues[0]!.id, "111", `t-${randomUUID()}`);
      expect(first.success).toBe(true);
      const second = await send(queues[1]!.id, "222", `t-${randomUUID()}`);
      expect(second).toMatchObject({ success: true, duplicate: true, leadId: (first as { leadId: string }).leadId });

      const leadId = (first as { leadId: string }).leadId;
      const [lead] = await tx.select({ queueId: s.leads.queueId, metaCampaignId: s.leads.metaCampaignId, sourceMetadata: s.leads.sourceMetadata }).from(s.leads).where(eq(s.leads.id, leadId));
      expect(lead!.metaCampaignId).toBe("111");
      expect((lead!.sourceMetadata as Record<string, unknown>).campaignName).toBe("Campanha 111");
      expect(lead!.queueId).toBe(queues[1]!.id);
      const [note] = await tx.select({ conteudo: s.leadInteractions.conteudo }).from(s.leadInteractions).where(eq(s.leadInteractions.leadId, leadId)).orderBy(desc(s.leadInteractions.createdAt)).limit(1);
      expect(note!.conteudo).toContain("novo formulário (campanha \"Campanha 222\")");
      expect(note!.conteudo).toContain("movido para a fila");

      // With a broker, the lead stays where it is and only gets the note.
      const [broker] = await tx.select({ userId: s.tenantMemberships.userId }).from(s.tenantMemberships).where(and(eq(s.tenantMemberships.tenantId, tenantId), eq(s.tenantMemberships.role, "broker"))).limit(1);
      await tx.update(s.leads).set({ corretorId: broker!.userId }).where(eq(s.leads.id, leadId));
      await send(queues[0]!.id, "333", `t-${randomUUID()}`);
      const [kept] = await tx.select({ queueId: s.leads.queueId }).from(s.leads).where(eq(s.leads.id, leadId));
      expect(kept!.queueId).toBe(queues[1]!.id);

      tx.rollback();
    }).catch((error) => {
      if (!String(error?.message ?? error).includes("Rollback")) throw error;
    });
  }, 60_000);
});

/**
 * Lead intake of a number dedicated to ads, against the real schema inside
 * one transaction that is ROLLED BACK. Nothing is sent: the AI start, the
 * attendance flows and the arrival notice are mocked. Opt-in only:
 *   RUN_CHANNEL_INTAKE_DB_E2E=1 npx vitest run src/features/communication-channels/channel-lead-intake.db.test.ts
 */
import { and, eq, isNotNull } from "drizzle-orm";
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
vi.mock("@/features/ai-qualification/service", () => ({ startAiQualificationForLead: vi.fn(async () => ({ started: false })) }));
vi.mock("@/features/attendance-flows/runtime", () => ({ attendanceFlowsEnabled: vi.fn(async () => false), startAttendanceRun: vi.fn() }));
vi.mock("@/features/attendance-flows/handlers", () => ({ flowEffectHandlers: vi.fn() }));
vi.mock("@/features/notifications/send-push-helper", () => ({ notifyLeadArrived: vi.fn(async () => undefined), sendNotificationToUser: vi.fn(async () => undefined) }));

const enabled = process.env.RUN_CHANNEL_INTAKE_DB_E2E === "1";
function readLocalEnv(name: string) {
  if (!existsSync(".env.local")) return "";
  const line = readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}
const url = enabled ? (readLocalEnv("SUPABASE_DB_URL") || readLocalEnv("DATABASE_URL")) : "";
const client = enabled ? postgres(url, { prepare: false, max: 1 }) : null;
const db = client ? drizzle(client, { schema: realSchema }) : null;
afterAll(async () => { await client?.end({ timeout: 5 }); });

describe.skipIf(!enabled)("lead intake of a number dedicated to ads (rolled back)", () => {
  it("creates the lead of a new contact with the number's origin and queue, and skips a contact from the app history", async () => {
    const s = realSchema;
    await db!.transaction(async (tx) => {
      state.tx = tx;
      const [channel] = await tx.select().from(s.communicationChannels).where(and(eq(s.communicationChannels.onboardingMode, "coexistence"), isNotNull(s.communicationChannels.activatedAt))).limit(1);
      expect(channel).toBeTruthy();
      const [queue] = await tx.select({ id: s.leadQueues.id }).from(s.leadQueues).where(and(eq(s.leadQueues.tenantId, channel!.tenantId), eq(s.leadQueues.status, "active"))).limit(1);
      const intake = { enabled: true, queueId: queue!.id, label: "Anúncios CA1 - Ancora Corretora", aiQualification: false };
      const { ingestChannelLead } = await import("./meta-ctwa-intake");

      // A new contact (fictitious number, never talked to this number).
      const newPhone = "5521900001234";
      const created = await ingestChannelLead({ tenantId: channel!.tenantId, channelId: channel!.id, phone: newPhone, profileName: "Cliente Teste", providerMessageId: `wamid.test.${randomUUID()}`, receivedAt: new Date(), intake, skipAiQualification: true });
      expect(created.status).toBe("created");
      const [lead] = await tx.select().from(s.leads).where(eq(s.leads.id, (created as { leadId: string }).leadId));
      expect(lead).toMatchObject({ nome: "Cliente Teste", queueId: queue!.id, sourceChannel: "meta_lead_ads", qualificationStatus: "ia_disabled" });
      expect(lead!.sourceMetadata).toMatchObject({ entry: "whatsapp", adsLabel: "Anúncios CA1 - Ancora Corretora", withoutReferral: true });

      // A contact that talked to this number before it was connected (an old
      // ad lead coming back) is a lead too.
      const historyPhone = "5521900005678";
      await tx.insert(s.whatsappMessages).values({ id: randomUUID(), tenantId: channel!.tenantId, communicationChannelId: channel!.id, provider: "meta_cloud", phone: historyPhone, direction: "incoming", body: "oi, tudo bem?", sentAt: new Date(channel!.activatedAt!.getTime() - 60_000) });
      const returning = await ingestChannelLead({ tenantId: channel!.tenantId, channelId: channel!.id, phone: historyPhone, providerMessageId: `wamid.test.${randomUUID()}`, receivedAt: new Date(), intake });
      expect(returning.status).toBe("created");

      tx.rollback();
    }).catch((error) => {
      if (!String(error?.message ?? error).includes("Rollback")) throw error;
    });
  }, 60_000);
});

/**
 * Characterization of how a team notice is routed (service engine, DEC-125).
 * Phase 0 fixed the old behaviour; phase 1 changed it on purpose and this file
 * now pins the new one:
 * which channel, which content and which fallback each operational event gets,
 * from the outbox row written at enqueue to the provider called when the row is
 * processed. Runs against the real schema inside ONE transaction that is
 * ROLLED BACK, with every provider call mocked: nothing is committed and no
 * message leaves. Opt-in only:
 *   RUN_OUTBOUND_DB_E2E=1 npx vitest run src/features/communication-channels/outbound-routing.db.test.ts
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as realSchema from "@/shared/db/schema";

vi.mock("server-only", () => ({}));

const state: { tx: unknown } = { tx: null };
vi.mock("@/shared/db", () => ({ schema: realSchema, getDatabase: () => state.tx }));

// Providers: record every call, never reach the network.
const calls: Array<{ provider: "meta_template" | "meta_text" | "waha"; name?: string; body?: string }> = [];
const wahaBehavior: { fail: boolean } = { fail: false };
vi.mock("./meta-cloud-client", async () => {
  const actual = await vi.importActual<typeof import("./meta-cloud-client")>("./meta-cloud-client");
  return {
    ...actual,
    sendMetaCloudTemplate: vi.fn(async (input: { templateName?: string; name?: string }) => {
      calls.push({ provider: "meta_template", name: input.templateName ?? input.name });
      return { messages: [{ id: `wamid.test.${calls.length}` }] };
    }),
    sendMetaCloudText: vi.fn(async (input: { body: string }) => {
      calls.push({ provider: "meta_text", body: input.body });
      return { messages: [{ id: `wamid.test.${calls.length}` }] };
    }),
  };
});
vi.mock("@/features/waha-cadence/relay-client", () => ({
  sendWahaRelayMessage: vi.fn(async (input: { body: string }) => {
    if (wahaBehavior.fail) throw new Error("relay down (test)");
    calls.push({ provider: "waha", body: input.body });
    return { messageId: `waha.test.${calls.length}` };
  }),
}));
vi.mock("./secret-crypto", () => ({ decryptChannelSecret: () => "test-token", encryptChannelSecret: () => "cipher" }));
vi.mock("./meta-cloud-config", () => ({ getMetaCloudServerConfig: () => ({ tokenEncryptionKey: "test-key", graphApiVersion: "v21.0" }) }));

const enabled = process.env.RUN_OUTBOUND_DB_E2E === "1";
function readLocalEnv(name: string) {
  if (!existsSync(".env.local")) return "";
  const line = readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}
const url = enabled ? (readLocalEnv("SUPABASE_DB_URL") || readLocalEnv("DATABASE_URL")) : "";
const client = enabled ? postgres(url, { prepare: false, max: 1 }) : null;
const db = client ? drizzle(client, { schema: realSchema }) : null;
afterAll(async () => { await client?.end({ timeout: 5 }); });

class Rollback extends Error {}
const FAKE_PHONE = "5521900000001"; // never a real person; providers are mocked anyway

type Tx = NonNullable<typeof db>;
type Outcome = { enqueue: { status: string; route: string | null; type: string | null; template: string | null; hold: string | null } | { error: string }; process?: { status: string; route: string | null; hold: string | null; error: string | null; calls: typeof calls } };

async function inRollback(run: (tx: Tx, tenantId: string, brokerId: string) => Promise<void>) {
  await db!.transaction(async (tx) => {
    state.tx = tx;
    const s = realSchema;
    // The tenant with an active Meta channel (the one that sends in production).
    const [channel] = await tx.select({ tenantId: s.communicationChannels.tenantId }).from(s.communicationChannels)
      .where(and(eq(s.communicationChannels.status, "active"), eq(s.communicationChannels.provider, "meta_cloud_api")))
      .limit(1);
    const tenantId = channel?.tenantId ?? (await tx.select({ tenantId: s.communicationChannels.tenantId }).from(s.communicationChannels).where(eq(s.communicationChannels.status, "active")).limit(1))[0].tenantId;
    const [broker] = await tx.select({ userId: s.tenantMemberships.userId }).from(s.tenantMemberships)
      .where(and(eq(s.tenantMemberships.tenantId, tenantId), eq(s.tenantMemberships.role, "broker"), eq(s.tenantMemberships.status, "active"))).limit(1);
    await run(tx as unknown as Tx, tenantId, broker.userId);
    throw new Rollback();
  }).catch((error) => { if (!(error instanceof Rollback)) throw error; });
}

async function scenario(tx: Tx, input: { tenantId: string; brokerId: string; purpose: string; recipientType?: "user" | "lead"; variables?: string[]; process?: boolean }): Promise<Outcome> {
  const outbound = await import("./outbound-service");
  calls.length = 0;
  let id: string;
  try {
    const queued = await outbound.enqueueMetaTemplateMessage({
      tenantId: input.tenantId,
      recipientType: input.recipientType ?? "user",
      recipientId: input.brokerId,
      destinationPhone: FAKE_PHONE,
      purpose: input.purpose,
      variables: input.variables ?? ["Corretor Teste", "Lead Teste", "Plano de saúde", "Individual", randomUUID()],
      idempotencyKey: `phase0:${input.purpose}:${randomUUID()}`,
    });
    id = queued.id;
  } catch (error) {
    return { enqueue: { error: error instanceof Error ? error.message : String(error) } };
  }
  const s = realSchema;
  const [row] = await tx.select().from(s.whatsappOutboundMessages).where(eq(s.whatsappOutboundMessages.id, id));
  const outcome: Outcome = { enqueue: { status: row.status, route: row.deliveryRoute, type: row.messageType, template: row.templateName, hold: row.holdReason } };
  if (input.process === false || row.status === "skipped") return outcome;
  await outbound.processMetaOutboundBatch(1, input.tenantId, id);
  const [after] = await tx.select().from(s.whatsappOutboundMessages).where(eq(s.whatsappOutboundMessages.id, id));
  outcome.process = { status: after.status, route: after.deliveryRoute, hold: after.holdReason, error: after.providerErrorCode ? `${after.providerErrorCode}: ${after.providerErrorMessage ?? ""}`.slice(0, 160) : null, calls: [...calls] };
  return outcome;
}

/** Sets the tenant's company number for the scenario: only a fresh fake one counts (rolled back). */
async function companyNumber(tx: Tx, tenantId: string, status: "active" | "disconnected" | "paused") {
  const s = realSchema;
  await tx.update(s.wahaNumbers).set({ status: "disconnected" }).where(and(eq(s.wahaNumbers.tenantId, tenantId), eq(s.wahaNumbers.scope, "tenant")));
  const numberId = randomUUID();
  await tx.insert(s.wahaNumbers).values({
    id: numberId, relaySessionId: `phase1-${numberId}`, displayPhoneNumber: `55219${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
    tenantId, scope: "tenant", status: status === "disconnected" ? "disconnected" : "active",
    pausedUntil: status === "paused" ? new Date(Date.now() + 10 * 60_000) : null,
    createdAt: new Date(Date.now() + 60_000), // the newest number is the company number
    capabilities: { inbound: false, cadence: false, ai: false },
  });
  return numberId;
}

async function notice(tx: Tx, tenantId: string, key: string, enabled: boolean, channel: "company_number" | "meta") {
  await tx.insert(realSchema.teamNoticeSettings).values({ tenantId, noticeKey: key, enabled, channel })
    .onConflictDoUpdate({ target: [realSchema.teamNoticeSettings.tenantId, realSchema.teamNoticeSettings.noticeKey], set: { enabled, channel } });
}

// Wednesday 30/09/2026 10:00 in São Paulo: inside business hours.
const WEDNESDAY_10AM = new Date("2026-09-30T13:00:00Z");
const SATURDAY_10AM = new Date("2026-10-03T13:00:00Z");
const report: Record<string, Outcome> = {};
beforeEach(() => {
  wahaBehavior.fail = false;
  vi.useFakeTimers({ toFake: ["Date"], shouldAdvanceTime: true });
  vi.setSystemTime(WEDNESDAY_10AM);
});
afterEach(() => { vi.useRealTimers(); });

const sentBy = (key: string) => report[key].process?.calls.map((call) => call.provider);

describe.skipIf(!enabled)("team notice routing (characterization, rolled back)", () => {
  it("routes each team notice by its setting, with the company number first and Meta as the fallback", async () => {
    await inRollback(async (tx, tenantId, brokerId) => {
      await companyNumber(tx, tenantId, "active");
      // Offer: locked to Meta (acceptance uses the template button).
      report.offer = await scenario(tx, { tenantId, brokerId, purpose: "newLeadAssignment" });
      // Lead information: company number first, built-in wording.
      report.confirmedByCompany = await scenario(tx, { tenantId, brokerId, purpose: "leadAssignmentConfirmed", variables: ["Corretor Teste", "Lead Teste", "(21) 90000-0000", "Plano de saúde", "Individual", "0", "Niterói", randomUUID()] });
      // Meta first: the template is missing on the sending number, so the company number carries it.
      await notice(tx, tenantId, "LEAD_ASSIGNMENT_CONFIRMED", true, "meta");
      report.confirmedMetaThenCompany = await scenario(tx, { tenantId, brokerId: randomUUID(), purpose: "leadAssignmentConfirmed", variables: ["Outro", "Lead", "(21) 90000-0001", "Plano", "Individual", "1", "Rio", randomUUID()] });
      // Default off: an expired offer is not sent at all (and never through another channel).
      report.expiredDefaultOff = await scenario(tx, { tenantId, brokerId, purpose: "leadAssignmentExpired" });
      // Reminder switched on: sent by the company number within business hours.
      await notice(tx, tenantId, "TASK_REMINDER", true, "company_number");
      vi.setSystemTime(new Date(WEDNESDAY_10AM.getTime() + 20_000)); // past the company number spacing
      report.taskReminderOn = await scenario(tx, { tenantId, brokerId: randomUUID(), purpose: "taskReminder", variables: ["Corretor Teste", "Ligar para o lead", "30/09 14:00"] });
    });

    await inRollback(async (tx, tenantId, brokerId) => {
      // Company number down: back to normal, the approved Meta template.
      await companyNumber(tx, tenantId, "disconnected");
      report.confirmedNumberDown = await scenario(tx, { tenantId, brokerId, purpose: "brokerAccountActivated", variables: ["Corretor Teste", "Âncora", "https://crm.example/login"] });
      await companyNumber(tx, tenantId, "paused");
      report.confirmedNumberPaused = await scenario(tx, { tenantId, brokerId, purpose: "brokerAccountActivated", variables: ["Corretor Teste", "Âncora", "https://crm.example/login"] });
    });

    await inRollback(async (tx, tenantId, brokerId) => {
      await companyNumber(tx, tenantId, "active");
      // WAHA fails at send time: the notice still reaches the person through Meta.
      wahaBehavior.fail = true;
      report.companyFailsFallsToMeta = await scenario(tx, { tenantId, brokerId, purpose: "brokerAccountActivated", variables: ["Corretor Teste", "Âncora", "https://crm.example/login"] });
      wahaBehavior.fail = false;
    });

    await inRollback(async (tx, tenantId, brokerId) => {
      await companyNumber(tx, tenantId, "active");
      await notice(tx, tenantId, "LEAD_FEEDBACK_REMINDER", true, "company_number");
      // At most 2 feedback reminders per person per day, spaced apart.
      report.reminder1 = await scenario(tx, { tenantId, brokerId, purpose: "leadFeedbackReminder", variables: ["Corretor Teste", "Lead B"] });
      vi.setSystemTime(new Date(WEDNESDAY_10AM.getTime() + 2 * 60_000));
      report.reminder2 = await scenario(tx, { tenantId, brokerId, purpose: "leadFeedbackReminder", variables: ["Corretor Teste", "Lead C"] });
      vi.setSystemTime(new Date(WEDNESDAY_10AM.getTime() + 4 * 60_000));
      report.reminder3 = await scenario(tx, { tenantId, brokerId, purpose: "leadFeedbackReminder", variables: ["Corretor Teste", "Lead D"] });
      // Outside business hours: waits for Monday 08:00 instead of sending.
      vi.setSystemTime(SATURDAY_10AM);
      report.reminderSaturday = await scenario(tx, { tenantId, brokerId: randomUUID(), purpose: "leadFeedbackReminder", variables: ["Corretor Teste", "Lead A"] });
      // Lead information is never held, even on a Saturday.
      report.confirmedSaturday = await scenario(tx, { tenantId, brokerId, purpose: "leadAssignmentConfirmed", variables: ["Corretor Teste", "Lead S", "(21) 90000-0002", "Plano", "Individual", "0", "Rio", randomUUID()] });
    });

    if (process.env.OUTBOUND_REPORT_FILE) writeFileSync(process.env.OUTBOUND_REPORT_FILE, JSON.stringify(report, null, 2));

    expect(report.offer).toMatchObject({ enqueue: { route: "meta_only", template: "new_lead_broker" }, process: { status: "sent" } });
    expect(sentBy("offer")).toEqual(["meta_template"]);

    expect(report.confirmedByCompany).toMatchObject({ enqueue: { route: "waha_direct" }, process: { status: "sent", route: "waha_direct" } });
    expect(sentBy("confirmedByCompany")).toEqual(["waha"]);
    expect(report.confirmedByCompany.process?.calls[0].body).toContain("Atribuição Confirmada");

    // Fixes the phase-0 defect: Meta has no template, the company number sends it.
    expect(report.confirmedMetaThenCompany.process).toMatchObject({ status: "sent", route: "waha_direct" });
    expect(sentBy("confirmedMetaThenCompany")).toEqual(["waha"]);

    expect(report.expiredDefaultOff).toMatchObject({ enqueue: { status: "skipped", hold: "disabled" } });
    expect(report.expiredDefaultOff.process).toBeUndefined();

    expect(report.taskReminderOn.process).toMatchObject({ status: "sent", route: "waha_direct" });

    expect(report.confirmedNumberDown).toMatchObject({ enqueue: { route: "meta_only", hold: "company_number_unavailable" }, process: { status: "sent" } });
    expect(sentBy("confirmedNumberDown")).toEqual(["meta_template"]);
    expect(report.confirmedNumberPaused).toMatchObject({ enqueue: { route: "meta_only", hold: "company_number_paused" } });

    expect(report.companyFailsFallsToMeta.process).toMatchObject({ status: "sent", route: "meta_only" });
    expect(sentBy("companyFailsFallsToMeta")).toEqual(["meta_template"]);

    expect(report.reminderSaturday.process).toMatchObject({ status: "queued", hold: "outside_business_hours" });
    expect(sentBy("reminderSaturday")).toEqual([]);
    expect(report.confirmedSaturday.process).toMatchObject({ status: "sent" });

    expect(report.reminder1.process).toMatchObject({ status: "sent" });
    expect(report.reminder2.process).toMatchObject({ status: "sent" });
    expect(report.reminder3.process).toMatchObject({ status: "skipped", hold: "reminder_daily_limit" });
    expect(sentBy("reminder3")).toEqual([]);
  }, 240_000);
});

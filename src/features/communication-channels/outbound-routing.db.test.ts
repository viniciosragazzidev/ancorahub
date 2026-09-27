/**
 * Characterization of how a message is routed today (service engine, phase 0):
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
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

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
type Outcome = { enqueue: { route: string | null; type: string | null; template: string | null; fallbackType: string | null } | { error: string }; process?: { status: string; route: string | null; error: string | null; calls: typeof calls } };

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
  const outcome: Outcome = { enqueue: { route: row.deliveryRoute, type: row.messageType, template: row.templateName, fallbackType: row.fallbackMessageType } };
  if (input.process === false) return outcome;
  await outbound.processMetaOutboundBatch(1, input.tenantId, id);
  const [after] = await tx.select().from(s.whatsappOutboundMessages).where(eq(s.whatsappOutboundMessages.id, id));
  outcome.process = { status: after.status, route: after.deliveryRoute, error: after.providerErrorCode ? `${after.providerErrorCode}: ${after.providerErrorMessage ?? ""}`.slice(0, 160) : null, calls: [...calls] };
  return outcome;
}

/** Connects a fake company number and routes one event to a free message through it. */
async function routeEventThroughCompanyNumber(tx: Tx, tenantId: string, eventKey: string, options: { messageActive?: boolean; numberStatus?: string } = {}) {
  const s = realSchema;
  // Only the number created here counts: any real company number of the tenant is set aside (rolled back).
  await tx.update(s.wahaNumbers).set({ status: "disconnected" }).where(and(eq(s.wahaNumbers.tenantId, tenantId), eq(s.wahaNumbers.scope, "tenant")));
  const numberId = randomUUID();
  await tx.insert(s.wahaNumbers).values({ id: numberId, relaySessionId: `phase0-${numberId}`, displayPhoneNumber: `55219${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`, tenantId, scope: "tenant", status: options.numberStatus ?? "active", capabilities: { inbound: false, cadence: false, ai: false } });
  const messageId = randomUUID();
  const [author] = await tx.select({ userId: s.tenantMemberships.userId }).from(s.tenantMemberships).where(eq(s.tenantMemberships.tenantId, tenantId)).limit(1);
  await tx.insert(s.messageTemplates).values({ id: messageId, tenantId, name: `phase0 ${eventKey}`, category: "operational", content: "Aviso de teste para {{nome}}", variables: [], active: options.messageActive ?? true, createdBy: author.userId });
  await tx.insert(s.systemSettings).values({ key: `tenant_channel_routing_${tenantId}`, value: JSON.stringify({ events: { [eventKey]: messageId } }) })
    .onConflictDoUpdate({ target: s.systemSettings.key, set: { value: JSON.stringify({ events: { [eventKey]: messageId } }) } });
}

const report: Record<string, Outcome> = {};
beforeEach(() => { wahaBehavior.fail = false; });

describe.skipIf(!enabled)("outbound routing today (characterization, rolled back)", () => {
  it("maps each operational event to a channel, content and fallback", async () => {
    await inRollback(async (tx, tenantId, brokerId) => {
      // Meta path (no company-number routing).
      for (const purpose of ["newLeadAssignment", "leadAssignmentExpired", "leadAssignmentConfirmed", "leadFeedbackReminder", "taskReminder", "brokerAccountActivated"]) {
        report[`meta:${purpose}`] = await scenario(tx, { tenantId, brokerId, purpose });
      }
      // Company number (WAHA) routing for a routable event.
      await routeEventThroughCompanyNumber(tx, tenantId, "LEAD_ASSIGNMENT_EXPIRED");
      report["waha:leadAssignmentExpired"] = await scenario(tx, { tenantId, brokerId, purpose: "leadAssignmentExpired" });
      wahaBehavior.fail = true;
      report["waha-down:leadAssignmentExpired"] = await scenario(tx, { tenantId, brokerId, purpose: "leadAssignmentExpired" });
      wahaBehavior.fail = false;
      // The offer is not routable: it stays on Meta even with a routing entry.
      await routeEventThroughCompanyNumber(tx, tenantId, "LEAD_OFFER");
      report["waha-attempt:newLeadAssignment"] = await scenario(tx, { tenantId, brokerId, purpose: "newLeadAssignment" });
    });
    await inRollback(async (tx, tenantId, brokerId) => {
      await routeEventThroughCompanyNumber(tx, tenantId, "TASK_REMINDER", { messageActive: false });
      report["waha-inactive-message:taskReminder"] = await scenario(tx, { tenantId, brokerId, purpose: "taskReminder" });
    });
    await inRollback(async (tx, tenantId, brokerId) => {
      await routeEventThroughCompanyNumber(tx, tenantId, "TASK_REMINDER", { numberStatus: "disconnected" });
      report["waha-disconnected:taskReminder"] = await scenario(tx, { tenantId, brokerId, purpose: "taskReminder" });
    });
    if (process.env.OUTBOUND_REPORT_FILE) writeFileSync(process.env.OUTBOUND_REPORT_FILE, JSON.stringify(report, null, 2));

    const sentBy = (key: string) => report[key].process?.calls.map((call) => call.provider);
    // Meta path: every broker notice leaves as a Meta template.
    expect(report["meta:newLeadAssignment"]).toMatchObject({ enqueue: { route: "meta_only", type: "template", template: "new_lead_broker" }, process: { status: "sent" } });
    expect(report["meta:leadAssignmentExpired"]).toMatchObject({ enqueue: { route: "meta_only", template: "lead_assignment_expired" }, process: { status: "sent" } });
    expect(report["meta:leadFeedbackReminder"]).toMatchObject({ enqueue: { template: "registrar_feedback_lead" }, process: { status: "sent" } });
    expect(report["meta:brokerAccountActivated"]).toMatchObject({ enqueue: { template: "broker_account_activated" }, process: { status: "sent" } });
    // KNOWN DEFECT today (fixed on purpose in phase 1): the resolver picks a
    // template the sending number does not have, so the notice leaves through
    // no channel at all. Seen in production as 31% of broker notices failing.
    expect(report["meta:leadAssignmentConfirmed"].process).toMatchObject({ status: "failed", calls: [] });
    expect(report["meta:leadAssignmentConfirmed"].process?.error).toMatch(/^TEMPLATE_NOT_IN_WABA/);
    expect(report["meta:taskReminder"].process).toMatchObject({ status: "failed", calls: [] });
    expect(report["meta:taskReminder"].process?.error).toMatch(/^TEMPLATE_NOT_IN_WABA/);

    // Company number (WAHA): the free message goes out, Meta is not called.
    expect(report["waha:leadAssignmentExpired"]).toMatchObject({ enqueue: { route: "waha_direct" }, process: { status: "sent", route: "waha_direct" } });
    expect(sentBy("waha:leadAssignmentExpired")).toEqual(["waha"]);
    // WAHA down at send time: the same notice falls back to the Meta template.
    expect(report["waha-down:leadAssignmentExpired"].process).toMatchObject({ status: "sent", route: "meta_only" });
    expect(sentBy("waha-down:leadAssignmentExpired")).toEqual(["meta_template"]);
    // The lead offer is not routable to WAHA today: it stays on Meta.
    expect(sentBy("waha-attempt:newLeadAssignment")).toEqual(["meta_template"]);
    // Inactive free message or disconnected number: back to Meta at enqueue
    // (and, for an unapproved template, the known defect above).
    expect(report["waha-inactive-message:taskReminder"].enqueue).toMatchObject({ route: "meta_only" });
    expect(report["waha-disconnected:taskReminder"].enqueue).toMatchObject({ route: "meta_only" });
  }, 180_000);
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { closingStageNoticeKey, entersClosingStage } from "./closing-stage-notice-core";
import { builtInNoticeVariants } from "@/features/team-notices/variants";
import { teamNoticeForPurpose } from "@/features/team-notices/catalog";
import { getMessageEventByPurpose } from "@/features/communication-channels/message-event-catalog";

const state = { broker: { name: "Ana Souza", phone: "5521999990000" } as { name: string; phone: string | null } | undefined };
// The outbox and the inbox are unique per idempotency key: the second send with the same key is a duplicate.
const outbox = new Set<string>();
const inbox = new Set<string>();
const enqueue = vi.fn(async (input: { idempotencyKey: string }) => {
  const duplicate = outbox.has(input.idempotencyKey);
  outbox.add(input.idempotencyKey);
  return { id: `out-${input.idempotencyKey}`, status: "queued", duplicate };
});
const dispatch = vi.fn(async () => ({ processed: 1, sent: 1, failed: 0, retried: 0 }));
const publish = vi.fn(async (input: { idempotencyKey: string }) => {
  inbox.add(input.idempotencyKey);
  return true;
});

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({
  getDatabase: () => ({
    select: () => ({ from: () => ({ leftJoin: () => ({ where: () => ({ limit: async () => (state.broker ? [state.broker] : []) }) }) }) }),
  }),
  schema: { user: { id: "id", name: "name" }, brokerProfiles: { userId: "userId", tenantId: "tenantId", phone: "phone" } },
}));
vi.mock("@/features/communication-channels/outbound-service", () => ({
  enqueueMetaTemplateMessage: (input: { idempotencyKey: string }) => enqueue(input),
  processMetaOutboundBatch: () => dispatch(),
}));
vi.mock("@/features/notifications/send-push-helper", () => ({ publishNotification: (input: { idempotencyKey: string }) => publish(input) }));

import { notifyBrokerClosingStage } from "./closing-stage-notice";

const move = (previousStatus: string, newStatus: string, brokerId: string | null = "broker-1") =>
  notifyBrokerClosingStage({ tenantId: "tenant-1", leadId: "lead-1", leadName: "Maria Lima", brokerId, previousStatus, newStatus });

beforeEach(() => {
  state.broker = { name: "Ana Souza", phone: "5521999990000" };
  outbox.clear();
  inbox.clear();
  enqueue.mockClear();
  dispatch.mockClear();
  publish.mockClear();
});

describe("lead na etapa de fechamento (03/11)", () => {
  it("counts only the entry into Documentação or Em análise", () => {
    expect(entersClosingStage("negotiation", "documentation_pending")).toBe(true);
    expect(entersClosingStage("quote_sent", "under_analysis")).toBe(true);
    expect(entersClosingStage("lost", "documentation_pending")).toBe(true);
    expect(entersClosingStage("documentation_pending", "under_analysis")).toBe(false);
    expect(entersClosingStage("documentation_pending", "documentation_pending")).toBe(false);
    expect(entersClosingStage("negotiation", "converted")).toBe(false);
    expect(entersClosingStage("in_contact", "negotiation")).toBe(false);
  });

  it("sends one WhatsApp and one in-app notice to the responsible broker on entry", async () => {
    await expect(move("negotiation", "documentation_pending")).resolves.toEqual({ notified: true });

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({
      recipientType: "user",
      recipientId: "broker-1",
      destinationPhone: "5521999990000",
      purpose: "leadClosingStage",
      variables: ["Ana", "Maria Lima", "lead-1"],
      idempotencyKey: closingStageNoticeKey("lead-1", "broker-1"),
    }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ capability: "lead_closing_stage", recipientUserId: "broker-1", url: "/leads/lead-1" }));
  });

  it("does nothing outside an entry or without a broker", async () => {
    await move("in_contact", "negotiation");
    await move("documentation_pending", "under_analysis");
    await move("documentation_pending", "documentation_pending");
    await move("negotiation", "documentation_pending", null);

    expect(enqueue).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("re-entering the stage reuses the same keys, so the broker gets a single message", async () => {
    await move("negotiation", "documentation_pending");
    await move("documentation_pending", "negotiation");
    await move("negotiation", "documentation_pending");

    expect(outbox.size).toBe(1);
    expect(inbox.size).toBe(1);
    // The duplicate is never dispatched again.
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("still notifies in the app when the broker has no phone, and never throws", async () => {
    state.broker = { name: "Ana", phone: null };
    await move("negotiation", "under_analysis");
    expect(enqueue).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledTimes(1);

    publish.mockRejectedValueOnce(new Error("push down"));
    await expect(notifyBrokerClosingStage({ tenantId: "t", leadId: "lead-2", leadName: null, brokerId: "broker-1", previousStatus: "new", newStatus: "under_analysis" })).resolves.toEqual({ notified: true });
  });

  it("is a team notice with its channel chosen in Avisos da equipe and editable library texts", () => {
    const notice = teamNoticeForPurpose("leadClosingStage");
    expect(notice?.key).toBe("LEAD_CLOSING_STAGE");
    expect(notice?.defaultChannel).toBe("company_number");
    expect(notice?.metaOnly).toBeFalsy();
    expect(getMessageEventByPurpose("leadClosingStage")?.variables.map((variable) => variable.key)).toEqual(["corretor_nome", "lead_nome", "lead_id"]);
  });

  it("every text congratulates and lists what to register, with the CRM link", () => {
    const versions = builtInNoticeVariants({ purpose: "leadClosingStage", broker: "Ana", lead: "Maria Lima", link: "https://crm.ancorasaude.cloud/leads/lead-1" }, 10);
    expect(versions).toHaveLength(4);
    for (const text of versions) {
      expect(text).toMatch(/parabéns|🎉/i);
      expect(text).toContain("Ana");
      expect(text).toContain("Maria Lima");
      for (const item of ["valor", "vidas", "operadora/plano", "documentos", "data"]) expect(text).toContain(item);
      expect(text).toContain("https://crm.ancorasaude.cloud/leads/lead-1");
    }
  });
});

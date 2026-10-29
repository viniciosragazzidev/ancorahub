import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const query = {
    from: () => query, where: () => query, orderBy: () => query,
    limit: async () => [{ id: "channel-test", wabaId: "waba-test" }],
  };
  return { insert: vi.fn(), select: () => query, legacyResolver: vi.fn() };
});

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", async () => ({
  schema: await import("@/shared/db/schema"), getDatabase: () => state,
}));
vi.mock("./phone-resolution", () => ({ resolveCanonicalWhatsAppDestination: async () => "5521900000001" }));
vi.mock("./message-policy-service", () => ({
  resolveEventMessagePlan: async () => null,
  resolveApprovedMetaEventTemplate: async () => null,
  isCustomerServiceWindowOpen: async () => false,
}));
vi.mock("./template-sync-service", () => ({ WhatsAppTemplateResolver: { resolveTemplateForEvent: state.legacyResolver } }));
// This suite validates the qualification template guard, not the database-backed
// sender selection. The route resolver has its own domain tests.
vi.mock("./meta-channel-router", () => ({
  resolveMetaOutboundChannel: async () => ({ id: "channel-test", wabaId: "waba-test" }),
}));

import { enqueueMetaTemplateMessage } from "./outbound-service";

describe("qualification enqueue without an eligible Utility template", () => {
  it.each([false, true])("blocks the legacy fallback before inserting an outbox row (requireApproved=%s)", async (requireApprovedMetaTemplate) => {
    await expect(enqueueMetaTemplateMessage({
      tenantId: "tenant-test", recipientType: "lead", recipientId: "lead-test",
      destinationPhone: "5521900000001", purpose: "leadQualification",
      variables: ["Cliente Teste"], idempotencyKey: "qualification-test",
      requireApprovedMetaTemplate,
    })).rejects.toMatchObject({ code: "FIRST_CONTACT_TEMPLATE_UNAVAILABLE" });
    expect(state.legacyResolver).not.toHaveBeenCalled();
    expect(state.insert).not.toHaveBeenCalled();
  });
});

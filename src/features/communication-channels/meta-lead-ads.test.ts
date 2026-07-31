import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { normalizeMetaLead, verifyMetaWebhookSignature } from "./meta-lead-ads";

describe("Meta Lead Ads normalization", () => {
  it("maps Meta standard fields without retaining unrelated form answers", () => {
    expect(normalizeMetaLead({
      id: "leadgen_123", ad_id: "ad_1", form_id: "form_1", created_time: "2026-07-31T12:34:56+0000",
      field_data: [
        { name: "full_name", values: ["Ana Lima"] },
        { name: "phone_number", values: ["+55 21 99999-0000"] },
        { name: "email", values: ["ana@example.test"] },
        { name: "medical_history", values: ["not persisted here"] },
      ],
    })).toEqual({ nome: "Ana Lima", telefone: "+55 21 99999-0000", email: "ana@example.test", externalId: "leadgen_123", adId: "ad_1", formId: "form_1", createdTime: "2026-07-31T12:34:56+0000" });
  });

  it("keeps createdTime null when Meta does not send created_time", () => {
    expect(normalizeMetaLead({ id: "leadgen_789", field_data: [{ name: "full_name", values: ["Leo Nunes"] }] })).toMatchObject({ externalId: "leadgen_789", createdTime: null });
  });

  it("supports split names and leaves missing contact data empty for the intake to reject", () => {
    expect(normalizeMetaLead({ id: "leadgen_456", field_data: [{ name: "first_name", values: ["João"] }, { name: "last_name", values: ["Silva"] }] })).toMatchObject({ nome: "João Silva", telefone: "", externalId: "leadgen_456" });
  });

  it("accepts only a valid Meta HMAC signature", async () => {
    const { createHmac } = await import("node:crypto");
    const body = JSON.stringify({ object: "page" });
    const signature = `sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`;
    expect(verifyMetaWebhookSignature(body, signature, "secret")).toBe(true);
    expect(verifyMetaWebhookSignature(body, "sha256=00", "secret")).toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./meta-cloud-config", () => ({
  getMetaLeadAdsWebhookConfig: () => ({ graphVersion: "v25.0" }),
}));

import { fetchMetaLead, normalizeMetaLead, resolveMetaCampaignIntake, resolveMetaLeadAdsSourceClaim, verifyMetaWebhookSignature } from "./meta-lead-ads";

describe("Meta Lead Ads normalization", () => {
  it("allows an inactive Page mapping to be claimed by another tenant, but never an active mapping", () => {
    const inactiveElsewhere = { id: "source-old", tenantId: "tenant-old", leadWebhookCredentialId: "credential-old", status: "inactive" };
    const activeElsewhere = { ...inactiveElsewhere, status: "active" };

    expect(resolveMetaLeadAdsSourceClaim(inactiveElsewhere, "tenant-new")).toBe("create");
    expect(() => resolveMetaLeadAdsSourceClaim(activeElsewhere, "tenant-new"))
      .toThrow("Esta Página Meta já está conectada a outra empresa.");
  });

  it("reuses the prior source when the current tenant reconnects its own Page", () => {
    expect(resolveMetaLeadAdsSourceClaim({ id: "source", tenantId: "tenant-current", leadWebhookCredentialId: "credential", status: "inactive" }, "tenant-current"))
      .toBe("reuse");
  });

  it("releases only a stale active Page whose owner explicitly disconnected Marketing", () => {
    const source = { id: "source-old", tenantId: "tenant-old", leadWebhookCredentialId: "credential-old", status: "active" };

    expect(resolveMetaLeadAdsSourceClaim(source, "tenant-new", true)).toBe("release_and_create");
    expect(() => resolveMetaLeadAdsSourceClaim(source, "tenant-new", false))
      .toThrow("Esta Página Meta já está conectada a outra empresa.");
  });

  it("ignores only campaigns explicitly disabled by the Director and otherwise resolves an active queue", () => {
    expect(resolveMetaCampaignIntake({ campaignRoute: { enabled: false, queueId: null, queueStatus: null } }))
      .toEqual({ action: "ignore", queueId: null });
    expect(resolveMetaCampaignIntake({ campaignRoute: { enabled: true, queueId: "queue-1", queueStatus: "active" } }))
      .toEqual({ action: "capture", queueId: "queue-1" });
    expect(resolveMetaCampaignIntake({ campaignRoute: { enabled: true, queueId: "queue-1", queueStatus: "inactive" } }))
      .toEqual({ action: "capture", queueId: null });
  });

  it("gives an ad rule precedence over the campaign rule", () => {
    expect(resolveMetaCampaignIntake({
      adRoute: { enabled: true, queueId: "queue-ad", queueStatus: "active" },
      campaignRoute: { enabled: true, queueId: "queue-campaign", queueStatus: "active" },
    })).toEqual({ action: "capture", queueId: "queue-ad" });
  });

  it("maps Meta standard fields without retaining unrelated form answers", () => {
    expect(normalizeMetaLead({
      id: "leadgen_123", ad_id: "ad_1", form_id: "form_1", created_time: "2026-07-31T12:34:56+0000",
      field_data: [
        { name: "full_name", values: ["Ana Lima"] },
        { name: "phone_number", values: ["+55 21 99999-0000"] },
        { name: "email", values: ["ana@example.test"] },
        { name: "medical_history", values: ["not persisted here"] },
      ],
    })).toEqual({ nome: "Ana Lima", telefone: "+55 21 99999-0000", email: "ana@example.test", externalId: "leadgen_123", campaignId: null, campaignName: null, adId: "ad_1", formId: "form_1", createdTime: "2026-07-31T12:34:56+0000" });
  });

  it("preserves the campaign identity needed for the queue entry rule", () => {
    expect(normalizeMetaLead({ id: "leadgen_campaign", campaign_id: "campaign_1", campaign_name: "PME Salvador", field_data: [] }))
      .toMatchObject({ campaignId: "campaign_1", campaignName: "PME Salvador" });
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

  it("never creates a synthetic lead when Meta rejects the lead lookup", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 100, message: "Unknown object" } }), { status: 404 })));

    await expect(fetchMetaLead("leadgen_missing", "tenant-page-token")).rejects.toMatchObject({
      name: "Error",
      status: 404,
      code: 100,
      message: "A Meta não permitiu carregar os detalhes deste lead. Ele não foi criado no CRM.",
    });
  });
});

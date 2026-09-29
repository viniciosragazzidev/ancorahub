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

  it("uses an enabled child route to refine the queue selected by an eligible campaign", () => {
    expect(resolveMetaCampaignIntake({
      adRoute: { enabled: true, queueId: "queue-ad", queueStatus: "active" },
      campaignRoute: { enabled: true, queueId: "queue-campaign", queueStatus: "active" },
    })).toEqual({ action: "capture", queueId: "queue-ad" });
  });

  it("does not confuse an active Meta campaign with CRM eligibility in selective mode", () => {
    expect(resolveMetaCampaignIntake({
      globalMode: "selective",
      hasTenantRules: true,
    })).toEqual({ action: "ignore", queueId: null });
  });

  it("does not let an old disabled ad or form rule discard an eligible campaign lead", () => {
    const campaignRoute = { enabled: true, queueId: "queue-campaign", queueStatus: "active" } as const;

    expect(resolveMetaCampaignIntake({
      adRoute: { enabled: false, queueId: null, queueStatus: null },
      campaignRoute,
      globalMode: "selective",
    })).toEqual({ action: "capture", queueId: "queue-campaign" });

    expect(resolveMetaCampaignIntake({
      formRoute: { enabled: false, queueId: null, queueStatus: null },
      campaignRoute,
      globalMode: "selective",
    })).toEqual({ action: "capture", queueId: "queue-campaign" });
  });

  it("maps Meta standard fields and keeps only the name of unrelated questions, never their answers", () => {
    expect(normalizeMetaLead({
      id: "leadgen_123", ad_id: "ad_1", form_id: "form_1", created_time: "2026-07-31T12:34:56+0000",
      field_data: [
        { name: "full_name", values: ["Ana Lima"] },
        { name: "phone_number", values: ["+55 21 99999-0000"] },
        { name: "email", values: ["ana@example.test"] },
        { name: "medical_history", values: ["not persisted here"] },
      ],
    })).toEqual({ nome: "Ana Lima", telefone: "+55 21 99999-0000", email: "ana@example.test", externalId: "leadgen_123", campaignId: null, campaignName: null, adId: "ad_1", formId: "form_1", createdTime: "2026-07-31T12:34:56+0000", unmappedFormFields: ["medical_history"] });
    expect(JSON.stringify(normalizeMetaLead({ id: "x", field_data: [{ name: "medical_history", values: ["diabetes"] }] }))).not.toContain("diabetes");
  });

  it("does not list contact or already-mapped questions as unmapped", () => {
    expect(normalizeMetaLead({
      id: "leadgen_all_mapped",
      field_data: [
        { name: "full_name", values: ["Ana Lima"] },
        { name: "Tipo de CNPJ", values: ["MEI"] },
        { name: "Operadora", values: ["Amil"] },
      ],
    })).not.toHaveProperty("unmappedFormFields");
  });

  it("preserves the campaign identity needed for the queue entry rule", () => {
    expect(normalizeMetaLead({ id: "leadgen_campaign", campaign_id: "campaign_1", campaign_name: "PME Salvador", field_data: [] }))
      .toMatchObject({ campaignId: "campaign_1", campaignName: "PME Salvador" });
  });

  it("captures the Meta Tipo de CNPJ answer and treats a CNPJ as a PME lead when no plan type was asked", () => {
    expect(normalizeMetaLead({
      id: "leadgen_cnpj_type",
      field_data: [
        { name: "full_name", values: ["Ana Lima"] },
        { name: "phone_number", values: ["+55 21 99999-0000"] },
        { name: "Tipo de CNPJ", values: ["MEI"] },
        { name: "medical_history", values: ["not persisted here"] },
      ],
    })).toMatchObject({ nome: "Ana Lima", tipoCnpj: "MEI", leadType: "PME" });
    expect(normalizeMetaLead({ id: "leadgen_without_cnpj_type", field_data: [] })).not.toHaveProperty("tipoCnpj");
    expect(normalizeMetaLead({ id: "leadgen_without_cnpj_type", field_data: [] })).not.toHaveProperty("leadType");
  });

  it("normalizes product, CNPJ type and carrier answers while keeping them separate", () => {
    expect(normalizeMetaLead({
      id: "leadgen_pme_product",
      field_data: [
        { name: "Tipo de Plano", values: ["PME"] },
        { name: "Tipo de CNPJ", values: ["MEI"] },
        { name: "Operadora de preferência", values: ["SulAmérica"] },
        { name: "medical_history", values: ["not persisted here"] },
      ],
    })).toMatchObject({ tipoPlano: "PME", leadType: "PME", tipoCnpj: "MEI", operadora: "SulAmérica" });
  });

  it("supports accented question labels and leaves unknown product answers unclassified", () => {
    expect(normalizeMetaLead({
      id: "leadgen_individual_product",
      field_data: [
        { name: "Modalidade do plano", values: ["Pessoa física"] },
        { name: "Operadora", values: ["Amil"] },
      ],
    })).toMatchObject({ tipoPlano: "Pessoa física", leadType: "PF", operadora: "Amil" });

    expect(normalizeMetaLead({
      id: "leadgen_unknown_product",
      field_data: [{ name: "Tipo de plano", values: ["Coletivo por adesão"] }],
    })).toMatchObject({ tipoPlano: "Coletivo por adesão" });
    expect(normalizeMetaLead({
      id: "leadgen_unknown_product",
      field_data: [{ name: "Tipo de plano", values: ["Coletivo por adesão"] }],
    })).not.toHaveProperty("leadType");
  });

  it("preserves the complete Meta attribution chain when provided", () => {
    expect(normalizeMetaLead({
      id: "leadgen-chain",
      campaign_id: "campaign-1",
      adset_id: "adset-1",
      ad_id: "ad-1",
      form_id: "form-1",
      page_id: "page-1",
      field_data: [],
    })).toMatchObject({
      campaignId: "campaign-1",
      adSetId: "adset-1",
      adId: "ad-1",
      formId: "form-1",
      pageId: "page-1",
    });
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

  it("requests only supported Lead fields so a webhook can create the lead", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "leadgen_supported",
      created_time: "2026-09-16T20:00:00+0000",
      ad_id: "ad-1",
      adset_id: "adset-1",
      form_id: "form-1",
      campaign_id: "campaign-1",
      campaign_name: "Campanha teste",
      field_data: [],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchMetaLead("leadgen_supported", "page-token");

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("fields=id,created_time,ad_id,adset_id,form_id,campaign_id,campaign_name,field_data");
    expect(requestedUrl).not.toContain("page_id");
  });
});

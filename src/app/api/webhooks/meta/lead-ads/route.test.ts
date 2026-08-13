import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMetaLeadAdsWebhookConfig: vi.fn(),
  ingestMetaLeadAdsWebhook: vi.fn(),
  verifyMetaWebhookSignature: vi.fn(),
}));

vi.mock("@/features/communication-channels/meta-cloud-config", () => ({
  getMetaLeadAdsWebhookConfig: mocks.getMetaLeadAdsWebhookConfig,
}));

vi.mock("@/features/communication-channels/meta-lead-ads", () => ({
  ingestMetaLeadAdsWebhook: mocks.ingestMetaLeadAdsWebhook,
  verifyMetaWebhookSignature: mocks.verifyMetaWebhookSignature,
}));

import { GET, POST } from "./route";

describe("Meta Lead Ads webhook", () => {
  it("confirma o desafio somente com o token de verificacao configurado", async () => {
    mocks.getMetaLeadAdsWebhookConfig.mockReturnValue({
      appSecret: "app-secret",
      webhookVerifyToken: "verify-token",
    });

    const accepted = await GET(new Request("https://crm.example/api/webhooks/meta/lead-ads?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=challenge"));
    const rejected = await GET(new Request("https://crm.example/api/webhooks/meta/lead-ads?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge"));

    await expect(accepted.text()).resolves.toBe("challenge");
    expect(accepted.status).toBe(200);
    expect(rejected.status).toBe(403);
  });

  it("rejeita a entrega sem assinatura valida antes de processar qualquer lead", async () => {
    mocks.getMetaLeadAdsWebhookConfig.mockReturnValue({ appSecret: "app-secret", webhookVerifyToken: "verify-token" });
    mocks.verifyMetaWebhookSignature.mockReturnValue(false);

    const response = await POST(new Request("https://crm.example/api/webhooks/meta/lead-ads", {
      method: "POST",
      body: JSON.stringify({ object: "page", entry: [] }),
      headers: { "Content-Type": "application/json" },
    }));

    expect(response.status).toBe(401);
    expect(mocks.ingestMetaLeadAdsWebhook).not.toHaveBeenCalled();
  });

  it("encaminha apenas uma entrega autenticada ao intake idempotente", async () => {
    mocks.getMetaLeadAdsWebhookConfig.mockReturnValue({ appSecret: "app-secret", webhookVerifyToken: "verify-token" });
    mocks.verifyMetaWebhookSignature.mockReturnValue(true);
    mocks.ingestMetaLeadAdsWebhook.mockResolvedValue({ received: 1, created: 1, ignored: 0 });
    const body = JSON.stringify({ object: "page", entry: [{ id: "page-1", changes: [] }] });

    const response = await POST(new Request("https://crm.example/api/webhooks/meta/lead-ads", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json", "x-hub-signature-256": "sha256=signed" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ accepted: true, created: 1 });
    expect(mocks.ingestMetaLeadAdsWebhook).toHaveBeenCalledWith({ object: "page", entry: [{ id: "page-1", changes: [] }] }, body, expect.any(Request));
  });
});

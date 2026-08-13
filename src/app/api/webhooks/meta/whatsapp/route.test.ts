import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMetaCloudServerConfig: vi.fn(),
  ingestMetaCloudWebhook: vi.fn(),
  isMetaCloudWhatsAppEnabled: vi.fn(),
}));

vi.mock("@/features/communication-channels/meta-cloud-config", () => ({
  getMetaCloudServerConfig: mocks.getMetaCloudServerConfig,
}));

vi.mock("@/features/communication-channels/service", () => ({
  ingestMetaCloudWebhook: mocks.ingestMetaCloudWebhook,
  isMetaCloudWhatsAppEnabled: mocks.isMetaCloudWhatsAppEnabled,
}));

import { GET, POST } from "./route";

const appSecret = "whatsapp-test-secret";

function signedRequest(body: string) {
  const signature = createHmac("sha256", appSecret).update(body).digest("hex");
  return new Request("https://crm.example/api/webhooks/meta/whatsapp", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json", "x-hub-signature-256": `sha256=${signature}` },
  });
}

describe("Meta WhatsApp webhook", () => {
  it("confirma o desafio somente com o token de verificacao configurado", async () => {
    mocks.getMetaCloudServerConfig.mockReturnValue({ appSecret, webhookVerifyToken: "verify-token" });

    const accepted = await GET(new Request("https://crm.example/api/webhooks/meta/whatsapp?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=challenge"));
    const rejected = await GET(new Request("https://crm.example/api/webhooks/meta/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge"));

    await expect(accepted.text()).resolves.toBe("challenge");
    expect(accepted.status).toBe(200);
    expect(rejected.status).toBe(403);
  });

  it("rejeita payload sem assinatura HMAC valida", async () => {
    mocks.getMetaCloudServerConfig.mockReturnValue({ appSecret, webhookVerifyToken: "verify-token" });

    const response = await POST(new Request("https://crm.example/api/webhooks/meta/whatsapp", {
      method: "POST",
      body: JSON.stringify({ object: "whatsapp_business_account", entry: [] }),
      headers: { "Content-Type": "application/json" },
    }));

    expect(response.status).toBe(401);
    expect(mocks.ingestMetaCloudWebhook).not.toHaveBeenCalled();
  });

  it("encaminha o payload assinado para a ingestao do canal oficial", async () => {
    mocks.getMetaCloudServerConfig.mockReturnValue({ appSecret, webhookVerifyToken: "verify-token" });
    mocks.isMetaCloudWhatsAppEnabled.mockResolvedValue(true);
    mocks.ingestMetaCloudWebhook.mockResolvedValue({ received: 1, processed: 1 });
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "waba-1", changes: [] }] });

    const response = await POST(signedRequest(body));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ accepted: true, processed: 1 });
    expect(mocks.ingestMetaCloudWebhook).toHaveBeenCalledWith({ object: "whatsapp_business_account", entry: [{ id: "waba-1", changes: [] }] }, body);
  });
});

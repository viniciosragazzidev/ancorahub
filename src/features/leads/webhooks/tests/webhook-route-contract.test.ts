import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticateLeadWebhook, createLeadFromWebhookSync } = vi.hoisted(() => ({
  authenticateLeadWebhook: vi.fn(),
  createLeadFromWebhookSync: vi.fn(),
}));

vi.mock("@/features/leads/webhooks/services/authenticate-lead-webhook", () => ({
  authenticateLeadWebhook,
  WebhookAuthError: class WebhookAuthError extends Error {},
}));

vi.mock("@/features/leads/webhooks/services/create-lead-from-webhook-sync", () => ({
  createLeadFromWebhookSync,
}));

import { POST } from "@/app/api/webhooks/leads/route";

const payload = { nome: "Maria da Silva", telefone: "+5511999999999" };

function request({
  authorization,
  contentType = "application/json",
  idempotencyKey,
  body = JSON.stringify(payload),
}: {
  authorization?: string;
  contentType?: string;
  idempotencyKey?: string;
  body?: string;
} = {}) {
  return new Request("http://localhost/api/webhooks/leads", {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      ...(authorization ? { Authorization: authorization } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body,
  });
}

describe("POST /api/webhooks/leads", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authenticateLeadWebhook.mockResolvedValue({
      tenantId: "tenant-a",
      branchId: "branch-a",
      credentialId: "credential-a",
      createdBy: "director-a",
    });
  });

  it("rejects non-JSON before authenticating", async () => {
    const response = await POST(request({ contentType: "text/plain", body: "not-json" }) as never);

    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({ success: false, error: { code: "UNSUPPORTED_MEDIA_TYPE" } });
    expect(authenticateLeadWebhook).not.toHaveBeenCalled();
  });

  it("rejects a request without a bearer token without exposing tenant information", async () => {
    const response = await POST(request() as never);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, error: { code: "UNAUTHORIZED", message: "Credenciais inválidas." } });
    expect(createLeadFromWebhookSync).not.toHaveBeenCalled();
  });

  it("returns 201 and passes only the authenticated tenant context to the intake service", async () => {
    createLeadFromWebhookSync.mockResolvedValue({ success: true, leadId: "lead-a", duplicate: false });

    const response = await POST(request({ authorization: "Bearer valid-token", idempotencyKey: "delivery-1" }) as never);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true, data: { leadId: "lead-a", duplicate: false } });
    expect(createLeadFromWebhookSync).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-a",
      branchId: "branch-a",
      credentialId: "credential-a",
      idempotencyKey: "delivery-1",
      payload,
    }));
  });

  it("returns replay as 200 and preserves the idempotency outcome", async () => {
    createLeadFromWebhookSync.mockResolvedValue({ success: true, leadId: "lead-a", duplicate: true });

    const response = await POST(request({ authorization: "Bearer valid-token", idempotencyKey: "delivery-1" }) as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { leadId: "lead-a", duplicate: true } });
  });

  it("returns a deterministic conflict for an idempotency key reused with another payload", async () => {
    createLeadFromWebhookSync.mockResolvedValue({ success: false, code: "IDEMPOTENCY_CONFLICT" });

    const response = await POST(request({ authorization: "Bearer valid-token", idempotencyKey: "delivery-1" }) as never);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ success: false, error: { code: "IDEMPOTENCY_CONFLICT" } });
  });

  it("rejects a body larger than the documented limit", async () => {
    const response = await POST(request({ authorization: "Bearer valid-token", body: "x".repeat(32 * 1024 + 1) }) as never);

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ success: false, error: { code: "PAYLOAD_TOO_LARGE" } });
    expect(createLeadFromWebhookSync).not.toHaveBeenCalled();
  });
});

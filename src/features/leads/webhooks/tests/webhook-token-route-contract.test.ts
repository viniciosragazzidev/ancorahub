import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authenticate: vi.fn(),
  createLead: vi.fn(),
}));

vi.mock("../services/authenticate-lead-webhook", async () => {
  const actual = await vi.importActual<typeof import("../services/authenticate-lead-webhook")>("../services/authenticate-lead-webhook");
  return { ...actual, authenticateLeadWebhook: state.authenticate };
});
vi.mock("../services/create-lead-from-webhook-sync", () => ({
  createLeadFromWebhookSync: state.createLead }));

import { POST } from "@/app/api/webhooks/leads/[token]/route";
import { WebhookAuthError } from "../services/authenticate-lead-webhook";

const credential = { credentialId: "credential-a", tenantId: "tenant-a", branchId: "branch-a", createdBy: "user-a", tenantStatus: "active" as const };
const params = { params: Promise.resolve({ token: "token-a" }) };

function request(body: unknown) {
  return new Request("http://localhost/api/webhooks/leads/token-a", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("POST /api/webhooks/leads/[token]", () => {
  it("does not process a landing page request when its token fails authentication", async () => {
    state.authenticate.mockRejectedValueOnce(new WebhookAuthError());
    const response = await POST(request({ nome: "Ana", telefone: "11999999999" }) as never, params);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ success: false, error: { code: "UNAUTHORIZED" } });
  });

  it("creates a landing-page lead only after the path token is authenticated", async () => {
    state.authenticate.mockResolvedValueOnce(credential);
    state.createLead.mockResolvedValueOnce({ success: true, leadId: "lead-a", duplicate: false });
    const response = await POST(request({ nome: "Ana", telefone: "(11) 99999-9999" }) as never, params);
    expect(response.status).toBe(201);
    expect(state.authenticate).toHaveBeenCalledWith("token-a");
    expect(state.createLead).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a", branchId: "branch-a", credentialId: "credential-a" }));
  });

  it("maps an invalid intake payload to 422 without exposing internal errors", async () => {
    state.authenticate.mockResolvedValueOnce(credential);
    state.createLead.mockResolvedValueOnce({ success: false, code: "INVALID_PAYLOAD", issues: ["telefone"] });
    const response = await POST(request({ nome: "Ana", telefone: "x" }) as never, params);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ success: false, error: { code: "INVALID_PAYLOAD" } });
  });
});

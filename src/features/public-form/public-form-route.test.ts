import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  receive: vi.fn(),
  authenticate: vi.fn(),
  createLead: vi.fn(),
  resolvePme: vi.fn(),
  queues: [] as Array<{ id: string; name: string }>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/leads/webhooks/services/authenticate-lead-webhook", () => ({
  authenticateLeadWebhook: state.authenticate,
  WebhookAuthError: class WebhookAuthError extends Error {},
}));
vi.mock("@/features/leads/webhooks/services/create-lead-from-webhook-sync", () => ({ createLeadFromWebhookSync: state.createLead }));
vi.mock("@/features/lead-distribution/pme-queue-routing", () => ({ resolvePmeQueueFor: state.resolvePme }));
vi.mock("@/shared/db", () => ({
  schema: { leadQueues: { id: "id", name: "name", tenantId: "tenant_id", status: "status", createdAt: "created_at" } },
  getDatabase: () => ({ select: () => ({ from: () => ({ where: () => ({ orderBy: async () => state.queues }) }) }) }),
}));

import { receivePublicForm } from "./intake";
import { createPublicFormRateLimiter, PUBLIC_FORM_LIMITS } from "./rate-limit";
import type { PublicFormSubmission } from "./form-flow";

const cpf: PublicFormSubmission = {
  kind: "cpf", name: "Maria Souza", people: "30 a 39 anos", ages: null, lives: 1, neighborhood: "Icaraí", city: "Niterói",
  currentPlan: "sem_plano", phone: "5521998765432", website: "", idempotencyKey: "chave-abcdef12",
};
const meta = { requestId: "req-1", userAgent: null, receivedAt: new Date("2026-11-23T12:00:00Z") };
const credential = { credentialId: "cred-1", tenantId: "tenant-1", branchId: "branch-1", createdBy: "user-1", tenantStatus: "active" };

describe("receivePublicForm", () => {
  beforeEach(() => {
    process.env.FORMULARIO_WEBHOOK_TOKEN = "token-formulario";
    process.env.FORMULARIO_FILA = "FILA PF - RENAN";
    state.queues = [{ id: "q-pf", name: "FILA PF - RENAN" }, { id: "q-pme", name: "FILA PME - RENAN" }];
    state.authenticate.mockResolvedValue(credential);
    state.createLead.mockResolvedValue({ success: true, leadId: "lead-1", duplicate: false });
    state.resolvePme.mockResolvedValue({ id: "q-pme", name: "FILA PME - RENAN", branchId: null });
  });
  afterEach(() => {
    delete process.env.FORMULARIO_WEBHOOK_TOKEN;
    delete process.env.FORMULARIO_FILA;
    vi.clearAllMocks();
  });

  it("fica fora do ar sem a fonte de captura configurada", async () => {
    delete process.env.FORMULARIO_WEBHOOK_TOKEN;
    expect(await receivePublicForm(cpf, meta)).toEqual({ ok: false, code: "UNAVAILABLE" });
    expect(state.createLead).not.toHaveBeenCalled();
  });

  it("CPF entra como lead PF na fila configurada, com origem formulario e as respostas", async () => {
    expect(await receivePublicForm(cpf, meta)).toEqual({ ok: true, leadId: "lead-1", duplicate: false });
    expect(state.createLead).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-1", queueId: "q-pf", credentialId: "cred-1", idempotencyKey: "formulario-chave-abcdef12",
      payload: { nome: "Maria Souza", telefone: "5521998765432", website: "" },
      formData: expect.objectContaining({ cidade: "Niterói", bairro: "Icaraí", idades: "30 a 39 anos" }),
      leadSource: expect.objectContaining({ channel: "formulario", leadType: "PF", externalId: "formulario-chave-abcdef12" }),
    }));
  });

  it("CNPJ entra como PME direto na fila PME da fila PF", async () => {
    await receivePublicForm({ ...cpf, kind: "cnpj", people: "3 a 9 pessoas", lives: null }, meta);
    expect(state.resolvePme).toHaveBeenCalledWith("tenant-1", "q-pf");
    expect(state.createLead).toHaveBeenCalledWith(expect.objectContaining({
      queueId: "q-pme",
      leadSource: expect.objectContaining({ leadType: "PME", metadata: expect.objectContaining({ companyRoutedToQueue: "FILA PME - RENAN" }) }),
    }));
  });

  it("honeypot preenchido não vira lead (a resposta é a mesma de sucesso)", async () => {
    state.createLead.mockResolvedValueOnce({ success: true, leadId: "honeypot-discarded", duplicate: false });
    expect(await receivePublicForm({ ...cpf, website: "http://spam" }, meta)).toEqual({ ok: true, leadId: null, duplicate: false });
    expect(state.createLead).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ website: "http://spam" }) }));
  });
});

describe("limite de envios do formulário", () => {
  it("segura o mesmo visitante depois de 4 envios no minuto e libera depois", () => {
    const limit = createPublicFormRateLimiter();
    const now = 1_000_000;
    for (let index = 0; index < PUBLIC_FORM_LIMITS.perVisitorMinute.requests; index += 1) expect(limit("1.2.3.4", now).ok).toBe(true);
    expect(limit("1.2.3.4", now).ok).toBe(false);
    expect(limit("5.6.7.8", now).ok).toBe(true);
    expect(limit("1.2.3.4", now + 61_000).ok).toBe(true);
  });
});

describe("POST /api/public/formulario", () => {
  it("valida o celular e só chama a entrada com o envio conferido", async () => {
    vi.resetModules();
    vi.doMock("@/features/public-form/intake", () => ({ receivePublicForm: state.receive }));
    const { POST } = await import("@/app/api/public/formulario/route");
    const send = (body: unknown) => POST(new Request("http://localhost/api/public/formulario", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }) as never);

    const invalid = await send({ ...cpf, phone: "21 3456-7890" });
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toMatchObject({ ok: false, retryable: false });
    expect(state.receive).not.toHaveBeenCalled();

    state.receive.mockResolvedValueOnce({ ok: true, leadId: "lead-1", duplicate: false });
    const created = await send({ ...cpf, phone: "(21) 99876-5432" });
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ ok: true });
    expect(state.receive).toHaveBeenCalledWith(expect.objectContaining({ phone: "5521998765432" }), expect.anything());

    state.receive.mockResolvedValueOnce({ ok: false, code: "FAILED" });
    const failed = await send(cpf);
    expect(failed.status).toBe(500);
    expect(await failed.json()).toMatchObject({ ok: false, retryable: true });

    const extra = await send({ ...cpf, token: "x" });
    expect(extra.status).toBe(422);
  });
});

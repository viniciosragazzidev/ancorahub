import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const state = vi.hoisted(() => ({ access: vi.fn(), canonical: vi.fn(), greeting: vi.fn(), duty: vi.fn(), audit: vi.fn(),
  rows: [] as unknown[][], select: vi.fn(), conditions: [] as unknown[] }));
vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => ({ select: state.select }) }));
vi.mock("./access", () => ({ requireExtensionAccess: state.access }));
vi.mock("@/features/lead-distribution/offers", () => ({ handleLeadOfferWebhookResponse: state.canonical }));
vi.mock("@/features/lead-distribution/active-queue-duty-roster", () => ({ findBrokerRunningDutyScheduleId: state.duty }));
vi.mock("@/features/leads/broker-greeting-server", () => ({ loadBrokerGreetingSafe: state.greeting }));
vi.mock("./audit", async () => ({ ...await vi.importActual<typeof import("./audit")>("./audit"), recordExtensionAudit: state.audit }));
import { GET } from "@/app/api/extension/offers/route";
import { POST as accept } from "@/app/api/extension/offers/[offerId]/accept/route";
import { POST as decline } from "@/app/api/extension/offers/[offerId]/decline/route";
import { listExtensionOffers, extensionOfferPayloadSchema } from "./offers";
import { AuthorizationError } from "@/shared/auth/errors";
const offerId = "00000000-0000-4000-8000-000000000001";
const context = { tenantId: "tenant-a", userId: "broker-a", role: "broker" as const, jobTitle: "broker", branchId: "branch-a" };
const session = { id: "session-a", userId: "broker-a", tenantId: "tenant-a", deviceId: "device-a", extensionVersion: "0.2.0" };
const offer = { id: offerId, leadId: "lead-a", status: "PENDING" };
const winner = { id: "lead-a", nome: "Cliente de teste", telefone: "+5511999990000", branchId: "branch-a" };
const params = { params: Promise.resolve({ offerId }) };
function request(action: string) { return new Request("https://crm.test/api/extension/offers/" + offerId + "/" + action,
  { method: "POST", body: JSON.stringify({ tenantId: "forged", brokerId: "forged", buttonText: "forged" }) }); }
beforeEach(() => {
  vi.clearAllMocks(); state.conditions = [];
  state.access.mockResolvedValue({ context, session });
  state.canonical.mockResolvedValue({ processed: true, action: "accepted", won: true, leadId: "lead-a" });
  state.greeting.mockResolvedValue("Olá, sou o corretor de teste."); state.duty.mockResolvedValue("duty-a");
  state.rows = [[offer], [winner]];
  state.select.mockImplementation(() => {
    const rows = state.rows.shift() ?? [];
    const query = { from: () => query, innerJoin: () => query, leftJoin: () => query,
      where: (condition: unknown) => { state.conditions.push(condition); return query; },
      orderBy: () => query, limit: async () => rows,
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve) };
    return query;
  });
});
describe("ofertas da extensão, somente mocks", () => {
  it("somente vencedor confirmado recebe telefone, saudação e URL", async () => {
    const response = await accept(request("accept"), params); const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, phone: "5511999990000", greeting: "Olá, sou o corretor de teste.", foraDoPlantao: false });
    expect(body.whatsappUrl).toContain("phone=5511999990000");
    expect(state.access).toHaveBeenCalledWith(expect.any(Request), "ACCEPT_LEAD");
    expect(state.canonical).toHaveBeenCalledWith({ tenantId: "tenant-a", brokerId: "broker-a", offerId, buttonText: "aceitar",
      audit: { action: "extension.offer.accepted", metadata: { source: "extension", tenantId: "tenant-a", deviceId: "device-a", sessionId: "session-a", extensionVersion: "0.2.0" } } });
  });
  it.each(["expired", "already_assigned", "offer_not_found"])("%s não libera contato nem saudação", async (reason) => {
    state.canonical.mockResolvedValue({ processed: true, won: false, reason });
    const response = await accept(request("accept"), params); const body = await response.json();
    expect(response.status).toBe(409); expect(body.success).toBe(false);
    expect(body).not.toHaveProperty("phone"); expect(body).not.toHaveProperty("greeting"); expect(body).not.toHaveProperty("whatsappUrl");
    expect(state.greeting).not.toHaveBeenCalled();
    if (reason === "expired") expect(body.message).toBe("O prazo para aceitar este lead terminou.");
  });
  it("outro corretor ou tenant não encontra oferta e não aciona serviço", async () => {
    state.rows = [[]];
    expect((await accept(request("accept"), params)).status).toBe(404);
    expect(state.canonical).not.toHaveBeenCalled();
    const filter = new PgDialect().sqlToQuery(state.conditions[0] as Parameters<PgDialect["sqlToQuery"]>[0]);
    expect(filter.params).toEqual(expect.arrayContaining([offerId, context.tenantId, context.userId]));
  });
  it.each(["manager", "director"])("papel %s não aceita nem lista", async (role) => {
    state.access.mockResolvedValue({ session, context: { ...context, role } });
    expect((await accept(request("accept"), params)).status).toBe(403);
    expect((await GET(new Request("https://crm.test/api/extension/offers"))).status).toBe(403);
    expect(state.canonical).not.toHaveBeenCalled(); expect(state.select).not.toHaveBeenCalled();
  });
  it("sem permissão do gate não toca ofertas", async () => {
    state.access.mockRejectedValue(new AuthorizationError("denied"));
    expect((await accept(request("accept"), params)).status).toBe(403);
    expect(state.canonical).not.toHaveBeenCalled();
  });
  it("already_accepted é idempotente apenas enquanto a oferta e propriedade ainda confirmam vencedor", async () => {
    state.canonical.mockResolvedValue({ processed: true, action: "accepted", won: false, reason: "already_accepted" });
    expect((await accept(request("accept"), params)).status).toBe(200);
    state.rows = [[offer], []];
    const response = await accept(request("accept"), params);
    expect(response.status).toBe(409); expect(await response.json()).not.toHaveProperty("phone");
  });
  it("fora do plantão só avisa; falha da consulta não desfaz aceite", async () => {
    state.duty.mockResolvedValue(null);
    expect(await (await accept(request("accept"), params)).json()).toMatchObject({ success: true, foraDoPlantao: true });
    state.rows = [[offer], [winner]]; state.duty.mockRejectedValue(new Error("lookup failed"));
    expect((await accept(request("accept"), params)).status).toBe(200);
  });
  it("recusa fixa avisa pulo, não retorna telefone e repetição não vira novo efeito", async () => {
    state.canonical.mockResolvedValue({ processed: true, action: "declined" });
    const response = await decline(request("decline"), params); const body = await response.json();
    expect(body).toMatchObject({ success: true, contaComoPulo: true }); expect(body).not.toHaveProperty("phone");
    expect(state.canonical).toHaveBeenCalledWith(expect.objectContaining({ buttonText: "recusar", audit: expect.objectContaining({ action: "extension.offer.declined" }) }));
    state.rows = [[{ ...offer, status: "DECLINED" }], [{ ...offer, status: "DECLINED" }]];
    state.canonical.mockResolvedValue({ processed: false, reason: "already_resolved" });
    expect(await (await decline(request("decline"), params)).json()).toMatchObject({ success: true, alreadyDeclined: true });
  });
  it("recusa de oferta aceita não se apresenta como recusa bem-sucedida", async () => {
    state.rows = [[{ ...offer, status: "ACCEPTED" }], [{ ...offer, status: "ACCEPTED" }]];
    state.canonical.mockResolvedValue({ processed: false, reason: "already_resolved" });
    expect((await decline(request("decline"), params)).status).toBe(409);
  });
  it("lista tem allowlist fechada e primeiro nome, sem contato completo", async () => {
    state.rows = [[{ ...offer, expiresAt: new Date("2026-11-04T12:00:00Z"), dutyName: "Plantão teste", name: "Ana Cliente Exemplo",
      phone: winner.telefone, qualificationStatus: "warm", cpf: "never-export", note: "never-export" }]];
    const [item] = await listExtensionOffers(context);
    expect(item).toMatchObject({ primeiroNome: "Ana", temperatura: "morno" });
    expect(Object.keys(item).sort()).toEqual(["id", "expiresAt", "plantao", "temperatura", "primeiroNome", "phoneMasked"].sort());
    expect(JSON.stringify(item)).not.toContain(winner.telefone); expect(JSON.stringify(item)).not.toContain("never-export");
    expect(extensionOfferPayloadSchema.safeParse({ ...item, phone: winner.telefone }).success).toBe(false);
    const filter = new PgDialect().sqlToQuery(state.conditions[0] as Parameters<PgDialect["sqlToQuery"]>[0]);
    expect(filter.params).toEqual(expect.arrayContaining([context.tenantId, context.userId, "PENDING", "SENT", "DELIVERED", "READ"]));
    expect(filter.sql).toContain('"expires_at" >');
  });
});

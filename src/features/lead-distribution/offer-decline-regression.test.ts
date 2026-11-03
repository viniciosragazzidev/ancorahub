import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  rows: [] as unknown[][], select: vi.fn(), update: vi.fn(), values: vi.fn(), transaction: vi.fn(),
  skip: vi.fn(), jobs: vi.fn(), signal: vi.fn(), updated: true,
}));
vi.mock("@/shared/db", async () => ({
  schema: await import("@/shared/db/schema"),
  getDatabase: () => ({ select: state.select, update: state.update, insert: () => ({ values: state.values }), transaction: state.transaction }),
}));
vi.mock("./ownership-signal", () => ({ signalLeadOwnershipChange: state.signal }));
vi.mock("./duty-skips", () => ({ applyDutySkipPolicy: state.skip }));
vi.mock("./jobs", () => ({ enqueueAndProcessLeadDistribution: state.jobs }));
vi.mock("@/features/communication-channels/outbound-service", () => ({ enqueueMetaTemplateMessage: vi.fn(), processMetaOutboundBatch: vi.fn() }));
vi.mock("@/features/leads/start-service-on-message", () => ({ startServiceOnFirstMessage: vi.fn() }));
vi.mock("@/features/leads/webhooks/services/lead-effect-outbox", () => ({ enqueueLeadEffectTx: vi.fn() }));
vi.mock("@/shared/tenant/system-user", () => ({ resolveSystemUserId: vi.fn() }));
import { handleLeadOfferWebhookResponse } from "./offers";

const now = new Date("2026-11-03T14:00:00Z");
const broker = { id: "broker-a", name: "Corretor de teste", phone: "+5511999990000" };
const offer = { id: "offer-a", tenantId: "tenant-a", brokerId: broker.id, leadId: "lead-a", dutyScheduleId: "duty-a",
  status: "PENDING", expiresAt: new Date(now.getTime() + 60_000) };
function query(rows: unknown[]) {
  const result = {
    from: () => result, innerJoin: () => result, leftJoin: () => result, where: () => result,
    orderBy: () => result, for: () => result, limit: async () => rows,
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  return result;
}
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now);
  state.updated = true; state.rows = [[broker], [offer], []];
  state.select.mockImplementation(() => query(state.rows.shift() ?? []));
  state.update.mockReturnValue({ set: () => ({ where: () => ({ returning: async () => state.updated ? [{ id: offer.id }] : [] }) }) });
  state.transaction.mockImplementation(async (work: (tx: { select: typeof state.select; update: typeof state.update }) => Promise<unknown>) => work({ select: state.select, update: state.update }));
});
afterEach(() => vi.useRealTimers());
const decline = () => handleLeadOfferWebhookResponse({ tenantId: "tenant-a", brokerId: broker.id, offerId: offer.id, buttonText: "recusar" });

describe("recusa canônica, sem banco", () => {
  it("recusa válida conta um pulo e mantém efeitos canônicos", async () => {
    expect(await decline()).toMatchObject({ processed: true, action: "declined" });
    expect(state.skip).toHaveBeenCalledExactlyOnceWith({ tenantId: "tenant-a", brokerId: broker.id, dutyScheduleId: offer.dutyScheduleId });
    expect(state.jobs).toHaveBeenCalledTimes(1);
    expect(state.values).toHaveBeenCalledWith(expect.objectContaining({ acao: "lead_offer_declined" }));
  });
  it("recusa vencida não altera oferta, não conta pulo e não redistribui", async () => {
    state.rows = [[broker], [{ ...offer, expiresAt: new Date(now.getTime() - 1) }]];
    expect(await decline()).toEqual({ processed: false, reason: "expired" });
    expect(state.update).not.toHaveBeenCalled();
    expect(state.skip).not.toHaveBeenCalled(); expect(state.jobs).not.toHaveBeenCalled(); expect(state.values).not.toHaveBeenCalled();
  });
  it.each(["ACCEPTED", "EXPIRED", "LOST", "DECLINED"])("%s não vira recusa bem-sucedida nem consome outro pulo", async (status) => {
    state.rows = [[broker], [{ ...offer, status }]];
    expect(await decline()).toEqual({ processed: false, reason: "already_resolved" });
    expect(state.update).not.toHaveBeenCalled(); expect(state.skip).not.toHaveBeenCalled(); expect(state.jobs).not.toHaveBeenCalled();
  });
  it("concorrência: UPDATE sem linha retorna already_resolved sem efeitos", async () => {
    state.updated = false;
    expect(await decline()).toEqual({ processed: false, reason: "already_resolved" });
    expect(state.skip).not.toHaveBeenCalled(); expect(state.jobs).not.toHaveBeenCalled(); expect(state.signal).not.toHaveBeenCalled(); expect(state.values).not.toHaveBeenCalled();
  });
  it("WhatsApp sem offerId preserva seleção e recusa válidas", async () => {
    const response = await handleLeadOfferWebhookResponse({ tenantId: "tenant-a", phone: broker.phone, buttonText: "recusar" });
    expect(response).toMatchObject({ processed: true, action: "declined" });
    expect(state.skip).toHaveBeenCalledTimes(1);
  });
  it("offerId não encontrado não faz fallback para outra oferta ativa", async () => {
    state.rows = [[broker], [], [offer]];
    expect(await decline()).toEqual({ processed: false, reason: "offer_not_found" });
    expect(state.select).toHaveBeenCalledTimes(2);
    expect(state.update).not.toHaveBeenCalled();
  });
  it("repetição da recusa não consome outro pulo", async () => {
    await decline();
    state.rows = [[broker], [{ ...offer, status: "DECLINED" }]];
    expect(await decline()).toEqual({ processed: false, reason: "already_resolved" });
    expect(state.skip).toHaveBeenCalledTimes(1); expect(state.jobs).toHaveBeenCalledTimes(1);
  });
  it("a auditoria da extensão usa a mesma operação canônica e metadata confiável", async () => {
    const metadata = { source: "extension", tenantId: "tenant-a", sessionId: "session-a", deviceId: "device-a", extensionVersion: "0.2.0" };
    await handleLeadOfferWebhookResponse({ tenantId: "tenant-a", brokerId: broker.id, offerId: offer.id, buttonText: "recusar",
      audit: { action: "extension.offer.declined", metadata } });
    expect(state.values).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ acao: "extension.offer.declined", metadata }));
    expect(state.skip).toHaveBeenCalledTimes(1);
  });
  it("aceite repetido por offerId preserva already_accepted sem novos efeitos", async () => {
    for (let i = 0; i < 2; i++) {
      const accepted = { ...offer, status: "ACCEPTED" };
      state.rows = [[broker], [accepted], [{ id: offer.leadId, corretorId: broker.id }], [accepted]];
      const response = await handleLeadOfferWebhookResponse({ tenantId: "tenant-a", brokerId: broker.id, offerId: offer.id, buttonText: "aceitar" });
      expect(response).toMatchObject({ processed: true, action: "accepted", won: false, reason: "already_accepted" });
    }
    expect(state.update).not.toHaveBeenCalled(); expect(state.values).not.toHaveBeenCalled();
    expect(state.skip).not.toHaveBeenCalled(); expect(state.jobs).not.toHaveBeenCalled();
  });
});

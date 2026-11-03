import { describe, expect, it } from "vitest";
import {
  emptyInboxState,
  handleInboxNotModified,
  inboxHeartbeatDue,
  INBOX_ALARM_MINUTES,
  INBOX_POLL_MS,
  notificationCopy,
  notificationId,
  offerIdFromNotification,
  parseRetryAfter,
  readInboxState,
  reconcileActiveOffers,
  reconcileInboxResponse,
  retryAfterTimestamp,
} from "../../../apps/browser-extension/src/background/inbox-state";

const agora = Date.parse("2026-11-03T12:00:00.000Z");

describe("estado da inbox E4", () => {
  it("preserva cursor e dados em resposta 304 sem corpo", () => {
    const state = readInboxState({
      generation: "g-1",
      cursor: "2026-11-03T11:59:00.000Z|n-1",
      processedIds: ["agent.lead_assigned:n-1"],
      activeOffers: [], warnedOfferIds: [], lastOffersSyncAt: agora - 30_000, retryAfterAt: 0,
    }, "g-1");

    const result = handleInboxNotModified(state, agora);

    expect(result.refreshOffers).toBe(false);
    expect(result.state).toBe(state);
    expect(result.state.cursor).toBe("2026-11-03T11:59:00.000Z|n-1");
  });

  it("usa pulso de 20 s com a aba e alarme de 1 min como reserva", () => {
    expect(INBOX_POLL_MS).toBe(20_000);
    expect(INBOX_ALARM_MINUTES).toBe(1);
    expect(inboxHeartbeatDue(agora, agora + 19_000)).toBe(true);
    expect(inboxHeartbeatDue(agora, agora + 18_999)).toBe(false);
  });

  it("mantém cursor do servidor, filtra tipos e descarta texto livre do CRM", () => {
    const state = emptyInboxState("g-1");
    const batch = reconcileInboxResponse(state, "g-1", {
      cursor: "cursor-seguro-2",
      items: [
        { id: "n-1", type: "agent.lead_assigned", leadId: "lead-falso-1", createdAt: "2026-11-03T11:59:00.000Z", title: "Cliente Exemplo", message: "mensagem privada" },
        { id: "n-2", type: "lead_unknown", leadId: "lead-falso-2", createdAt: "2026-11-03T11:59:30.000Z", title: "ignorar", message: "ignorar" },
      ],
    });

    expect(batch?.state.cursor).toBe("cursor-seguro-2");
    expect(batch?.notices).toEqual([{ id: "n-1", type: "agent.lead_assigned", leadId: "lead-falso-1", createdAt: "2026-11-03T11:59:00.000Z" }]);
    expect(JSON.stringify(batch)).not.toMatch(/Cliente Exemplo|mensagem privada|title|message/);
  });

  it("deduplica notificação por tipo e id e reinicia o estado ao trocar geração", () => {
    const event = { id: "n-1", type: "lead_reopened", leadId: null, createdAt: "2026-11-03T11:59:00.000Z" };
    const first = reconcileInboxResponse(emptyInboxState("g-1"), "g-1", { cursor: "c1", items: [event] });
    const repeated = reconcileInboxResponse(first!.state, "g-1", { cursor: "c2", items: [event] });
    const newGeneration = readInboxState(first!.state, "g-2");

    expect(first?.notices).toHaveLength(1);
    expect(repeated?.notices).toHaveLength(0);
    expect(newGeneration.cursor).toBeNull();
    expect(newGeneration.processedIds).toEqual([]);
  });

  it("reconcilia ofertas e emite aviso de último minuto uma vez", () => {
    const offer = { id: "offer-falso-1", expiresAt: new Date(agora + 45_000).toISOString() };
    const first = reconcileActiveOffers(emptyInboxState("g-1"), [offer], agora)!;
    const repeated = reconcileActiveOffers(first.state, [offer], agora + 1_000)!;
    const expired = reconcileActiveOffers(repeated.state, [], agora + 50_000)!;

    expect(first.newOffers).toEqual([offer]);
    expect(first.lastMinute).toEqual([offer]);
    expect(repeated.newOffers).toEqual([]);
    expect(repeated.lastMinute).toEqual([]);
    expect(expired.removedIds).toEqual([offer.id]);
    expect(expired.state.activeOffers).toEqual([]);
  });

  it("mapeia clique de notificação para a oferta pendente sem executar aceite", () => {
    const active = reconcileActiveOffers(emptyInboxState("g-1"), [{ id: "offer-falso-2", expiresAt: new Date(agora + 90_000).toISOString() }], agora)!.state;
    const pendingId = notificationId({ id: "offer-falso-2", type: "lead_offer_pending" });
    const lastMinuteId = notificationId({ id: "offer-falso-2", type: "offer_last_minute" });

    expect(offerIdFromNotification(active, pendingId)).toBe("offer-falso-2");
    expect(offerIdFromNotification(active, lastMinuteId)).toBe("offer-falso-2");
    expect(offerIdFromNotification(active, "ancora-task_overdue-fake")).toBeUndefined();
  });

  it("aplica Retry-After e usa texto de notificação genérico", () => {
    expect(parseRetryAfter("30", agora)).toBe(30);
    expect(parseRetryAfter(new Date(agora + 45_000).toUTCString(), agora)).toBe(45);
    expect(parseRetryAfter("inválido", agora)).toBeUndefined();
    expect(retryAfterTimestamp(30, agora)).toBe(agora + 30_000);
    expect(retryAfterTimestamp(86_400, agora)).toBe(agora + 86_400_000);
    expect(notificationCopy("lead_client_returned")).toEqual({ title: "Atualização do CRM", message: "Um cliente respondeu." });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  lead: { nome: "Maria Lima", monthlyValue: "500", brokerName: "Tainá Pinto" } as { nome: string; monthlyValue: string | null; brokerName: string | null } | undefined,
  directors: [{ userId: "dir-1" }, { userId: "dir-2" }],
};
// The inbox is unique per idempotency key: the second insert with the same key is a duplicate.
const inbox = new Set<string>();
const publish = vi.fn(async (input: { idempotencyKey: string }) => {
  if (inbox.has(input.idempotencyKey)) return true;
  inbox.add(input.idempotencyKey);
  return true;
});

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({
  getDatabase: () => ({
    select: () => ({
      from: (table: string) => table === "memberships"
        ? { where: () => ({ groupBy: () => ({ limit: async () => state.directors }) }) }
        : { leftJoin: () => ({ where: () => ({ limit: async () => (state.lead ? [state.lead] : []) }) }) },
    }),
  }),
  schema: {
    leads: { id: "id", tenantId: "tenantId", nome: "nome", monthlyValue: "monthlyValue", corretorId: "corretorId" },
    user: { id: "id", name: "name" },
    tenantMemberships: "memberships",
  },
}));
vi.mock("drizzle-orm", () => ({ and: () => null, eq: () => null }));
vi.mock("@/features/notifications/send-push-helper", () => ({ publishNotification: (input: { idempotencyKey: string }) => publish(input) }));

import { notifyDirectorsClosingOutcome } from "./closing-outcome-notice";

const changedAt = new Date("2026-11-09T15:00:00.000Z");
const leave = (overrides: Partial<Parameters<typeof notifyDirectorsClosingOutcome>[0]> = {}) => notifyDirectorsClosingOutcome({
  tenantId: "tenant-1",
  leadId: "lead-1",
  previousStatus: "under_analysis",
  newStatus: "lost",
  actorType: "broker",
  actorUserId: "broker-1",
  changedAt,
  previousStageEnteredAt: new Date("2026-10-20T15:00:00.000Z"),
  lossCode: "preco",
  ...overrides,
});

beforeEach(() => {
  state.lead = { nome: "Maria Lima", monthlyValue: "500", brokerName: "Tainá Pinto" };
  state.directors = [{ userId: "dir-1" }, { userId: "dir-2" }];
  inbox.clear();
  publish.mockClear();
});

describe("desfecho do fechamento: aviso à direção", () => {
  it("avisa cada diretor quando o corretor perde o lead, com motivo e dias", async () => {
    await expect(leave()).resolves.toEqual({ notified: 2 });
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      capability: "lead_closing_outcome",
      recipientUserId: "dir-1",
      leadId: "lead-1",
      title: "Desfecho do fechamento: Maria Lima perdeu",
      message: "Corretor: Tainá Pinto. Motivo: Preço acima do esperado. 20 dias no fechamento.",
      url: "/leads/lead-1",
    }));
  });

  it("na venda usa o valor aprovado", async () => {
    await leave({ newStatus: "converted", lossCode: null, saleValue: 1234.5 });
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ title: "Desfecho do fechamento: Maria Lima fechou", message: expect.stringMatching(/Valor: R\$\s?1\.234,50\/mês/) }));
  });

  it("a mesma saída não gera duas notificações", async () => {
    await leave();
    await leave();
    expect(new Set(publish.mock.calls.map(([input]) => input.idempotencyKey)).size).toBe(2);
    expect(inbox.size).toBe(2);
  });

  it("regra, sistema e IA nunca avisam; andar dentro do fechamento também não", async () => {
    await leave({ actorType: "rule", newStatus: "awaiting_reply" });
    await leave({ actorType: "system" });
    await leave({ actorType: "ai" });
    await leave({ previousStatus: "documentation_pending", newStatus: "under_analysis" });
    await leave({ previousStatus: "negotiation" });
    expect(publish).not.toHaveBeenCalled();
  });

  it("sem diretor ativo ou lead sumido não avisa e não lança erro", async () => {
    state.directors = [];
    await expect(leave()).resolves.toEqual({ notified: 0 });
    state.directors = [{ userId: "dir-1" }];
    state.lead = undefined;
    await expect(leave()).resolves.toEqual({ notified: 0 });
  });
});

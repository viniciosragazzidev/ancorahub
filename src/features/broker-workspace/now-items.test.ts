import { describe, expect, it } from "vitest";

import type { BrokerWorkspacePriority } from "./priority";
import { buildBrokerNowItems } from "./now-items";

const now = new Date("2026-10-17T15:00:00-03:00");

function priority(overrides: Partial<BrokerWorkspacePriority>): BrokerWorkspacePriority {
  return {
    kind: "awaiting_response",
    severity: "critical",
    leadId: "reply-1",
    dueAt: null,
    referenceAt: now,
    title: "Cliente respondeu",
    description: "Aguardando resposta do corretor.",
    href: "/leads/reply-1",
    ...overrides,
  };
}

describe("buildBrokerNowItems", () => {
  it("shows acceptance, client reply and overdue return in the requested order", () => {
    const items = buildBrokerNowItems({
      now,
      pendingOffers: [
        { leadId: "accept-later", name: "Prazo longo", offeredAt: new Date("2026-10-17T14:00:00-03:00"), expiresAt: new Date("2026-10-17T15:10:00-03:00"), scheduleName: "PME MANHÃ" },
        { leadId: "accept-first", name: "Prazo curto", offeredAt: new Date("2026-10-17T14:55:00-03:00"), expiresAt: new Date("2026-10-17T15:04:00-03:00"), scheduleName: "PRESENCIAL TARDE" },
      ],
      priorities: [priority({ leadId: "reply-old", title: "Resposta antiga", referenceAt: new Date("2026-10-17T14:00:00-03:00") }), priority({ leadId: "reply-new", title: "Resposta nova", referenceAt: new Date("2026-10-17T14:59:00-03:00") })],
      agenda: [
        { id: "return-1", leadId: "return-1", leadName: "Cliente do retorno", title: "Retorno do cliente", dueAt: new Date("2026-10-17T14:00:00-03:00"), priority: "urgent", href: "/leads/return-1#tarefas" },
        { id: "task-1", leadId: "task-1", leadName: "Outra tarefa", title: "Enviar documento", dueAt: new Date("2026-10-17T13:00:00-03:00"), priority: "normal", href: "/leads/task-1#tarefas" },
      ],
    });

    expect(items.map((item) => item.id)).toEqual(["accept-accept-first", "reply-reply-new", "return-return-1"]);
    expect(items[0]).toMatchObject({ actionLabel: "Aceitar e chamar", href: "/leads/accept-first", expiresAt: "2026-10-17T18:04:00.000Z" });
    expect(items[0]?.detail).toContain("Plantão PRESENCIAL TARDE");
  });

  it("does not revive expired offers as a next step", () => {
    const items = buildBrokerNowItems({
      now,
      pendingOffers: [{ leadId: "old", name: "Expirou", offeredAt: new Date("2026-10-17T13:00:00-03:00"), expiresAt: new Date("2026-10-17T14:00:00-03:00"), scheduleName: null }],
      priorities: [],
      agenda: [],
    });
    expect(items).toEqual([]);
  });
});

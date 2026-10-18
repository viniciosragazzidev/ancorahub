import { describe, expect, it } from "vitest";

import type { BrokerWorkspacePriority } from "@/features/broker-workspace/priority";

import { pickBrokerTip } from "./pick-tip";

const now = new Date("2026-10-12T15:00:00.000Z");
const action = (kind: BrokerWorkspacePriority["kind"], minutesAgo: number, leadId: string): BrokerWorkspacePriority => ({ kind, severity: "warning", leadId, dueAt: null, referenceAt: new Date(now.getTime() - minutesAgo * 60_000), title: "", description: "", href: `/leads/${leadId}` });

describe("pickBrokerTip", () => {
  it("puts a client waiting for an answer first and uses the AI step when there is one", () => {
    const tip = pickBrokerTip({
      queue: [
        { id: "l1", name: "João Reis", nextAction: action("return_due", 30, "l1") },
        { id: "l2", name: "Maria Souza", nextAction: action("awaiting_response", 120, "l2") },
      ],
      aiStep: new Map([["l2", "Mandar a cotação"]]),
      now,
    });
    expect(tip).toMatchObject({ leadId: "l2", tone: "urgent", title: "Maria está esperando você", cta: { label: "Responder Maria", href: "/leads/l2" } });
    expect(tip?.text).toBe("Dica: Mandar a cotação.");
    expect(tip?.live).toMatchObject({ at: "2026-10-12T13:00:00.000Z", othersWaiting: 0 });
    expect(tip?.id).toBe("awaiting_response:l2:2026-10-12");
  });

  it("falls back to a practical tip without the AI, and returns null with nothing to do", () => {
    const tip = pickBrokerTip({ queue: [{ id: "l3", name: "Ana", nextAction: action("sla_risk", 5, "l3") }], now });
    expect(tip).toMatchObject({ title: "Lead novo: Ana", cta: { label: "Chamar Ana" } });
    expect(pickBrokerTip({ queue: [{ id: "l4", name: "Bia", nextAction: action("new_lead", 1, "l4") }, { id: "l5", name: "Caio", nextAction: null }], now })).toBeNull();
  });

  it("counts the other clients waiting, so the broker sees the whole picture", () => {
    const tip = pickBrokerTip({
      queue: [
        { id: "a", name: "Ana", nextAction: action("awaiting_response", 50, "a") },
        { id: "b", name: "Bia", nextAction: action("awaiting_response", 10, "b") },
        { id: "c", name: "Caio", nextAction: action("awaiting_response", 5, "c") },
        { id: "d", name: "Duda", nextAction: action("return_due", 5, "d") },
      ],
      now,
    });
    expect(tip?.leadId).toBe("a");
    expect(tip?.live.othersWaiting).toBe(2);
  });
});

import { describe, expect, it } from "vitest";

import type { BrokerWorkspacePriority } from "@/features/broker-workspace/priority";
import type { BrokerJourneyData, JourneyMissionCard } from "@/features/engagement/journey-types";

import { nextActionOf } from "./next-action";

const now = new Date("2026-10-10T15:00:00Z");
const priority = (values: Partial<BrokerWorkspacePriority>): BrokerWorkspacePriority => ({ kind: "awaiting_response", severity: "warning", leadId: "l1", dueAt: null, referenceAt: new Date("2026-10-10T14:54:00Z"), title: "Carla Mendes", description: "Mensagem nova", href: "/leads/l1", ...values });
const mission = (remaining: number, values: Partial<JourneyMissionCard> = {}) => ({ id: "m", title: "Zerar os retornos", bonusPoints: 20, progress: { eligible: true, completed: false, remaining }, ...values }) as unknown as JourneyMissionCard;
const journey = (missions: JourneyMissionCard[]) => ({ missions }) as unknown as BrokerJourneyData;

describe("nextActionOf", () => {
  it("turns the server priority into a short action with how long it waits", () => {
    expect(nextActionOf(priority({}), null, now)).toEqual({ label: "Responder Carla", detail: "Está esperando sua resposta há 6 min.", href: "/leads/l1", urgent: false });
  });

  it("marks a broken first-contact deadline as urgent", () => {
    expect(nextActionOf(priority({ kind: "sla_overdue", severity: "critical" }), null, now)).toMatchObject({ label: "Atender Carla", urgent: true });
  });

  it("a new lead becomes 'Aceitar e chamar no WhatsApp', urgent, accepting it right there", () => {
    expect(nextActionOf(priority({ kind: "new_lead", title: "Amilton Damasceno" }), null, now)).toMatchObject({ label: "Aceitar e chamar no WhatsApp", urgent: true, acceptLeadId: "l1" });
  });

  it("falls back to a mission one step from done, the richest first", () => {
    const result = nextActionOf(null, journey([mission(1), mission(1, { id: "n", title: "Equipe sem SLA", bonusPoints: 40 } as Partial<JourneyMissionCard>), mission(3)]), now);
    expect(result).toMatchObject({ label: "Fechar a missão", href: "/jornada" });
    expect(result?.detail).toContain("Equipe sem SLA");
  });

  it("says nothing when everything is in order", () => {
    expect(nextActionOf(null, journey([mission(2)]), now)).toBeNull();
    expect(nextActionOf(null, null, now)).toBeNull();
  });
});

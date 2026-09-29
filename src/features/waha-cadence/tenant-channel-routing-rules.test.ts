import { describe, expect, it } from "vitest";

import { getMessageEventByKey } from "@/features/communication-channels/message-event-catalog";
import {
  isTenantChannelRoutableEvent,
  normalizeTenantChannelRouting,
  renderTenantChannelMessage,
} from "./tenant-channel-routing-rules";

describe("tenant channel routing rules", () => {
  it("never routes the offer, the presence confirmation or the first-access invite", () => {
    expect(isTenantChannelRoutableEvent("LEAD_OFFER")).toBe(false);
    expect(isTenantChannelRoutableEvent("DUTY_PRESENCE_CONFIRMATION")).toBe(false);
    expect(isTenantChannelRoutableEvent("BROKER_WELCOME")).toBe(false);
    expect(isTenantChannelRoutableEvent("LEAD_ASSIGNMENT_EXPIRED")).toBe(true);
  });

  it("keeps only routable events with a message id", () => {
    expect(normalizeTenantChannelRouting({ events: { LEAD_ASSIGNMENT_EXPIRED: "m1", LEAD_OFFER: "m2", TASK_REMINDER: " " } }))
      .toEqual({ events: { LEAD_ASSIGNMENT_EXPIRED: "m1" } });
    expect(normalizeTenantChannelRouting(null)).toEqual({ events: {} });
  });

  it("fills {{nome}} with the broker on broker-only notices (the 'lead_expirado' free message)", () => {
    const event = getMessageEventByKey("LEAD_ASSIGNMENT_EXPIRED")!;
    expect(renderTenantChannelMessage(event, "Olá, {{nome}}! Atente-se ao tempo para aceitar o lead para evitar redistribuições!↔️", ["Marcio Peixoto 11150"]))
      .toBe("Olá, Marcio Peixoto 11150! Atente-se ao tempo para aceitar o lead para evitar redistribuições!↔️");
  });

  it("keeps the catalog meaning of {{nome}} (the lead) where the notice carries a lead", () => {
    const event = getMessageEventByKey("LEAD_FEEDBACK_REMINDER")!;
    expect(renderTenantChannelMessage(event, "{{corretor_nome}}, registre o feedback de {{nome}}.", ["Kaio", "Neusa Galvao"]))
      .toBe("Kaio, registre o feedback de Neusa Galvao.");
  });
});

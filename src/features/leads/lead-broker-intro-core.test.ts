import { describe, expect, it } from "vitest";

import { getMessageEventByPurpose, renderEventFreeMessage } from "@/features/communication-channels/message-event-catalog";
import { formatBrokerPhone, LEAD_BROKER_INTRO_PURPOSE, leadBrokerIntroVariables } from "./lead-broker-intro-core";

describe("apresentação do corretor ao lead (29/10)", () => {
  it("formats the broker's number with or without the 55", () => {
    expect(formatBrokerPhone("5521999998888")).toBe("(21) 99999-8888");
    expect(formatBrokerPhone("21999998888")).toBe("(21) 99999-8888");
    expect(formatBrokerPhone("+55 (21) 3333-4444")).toBe("(21) 3333-4444");
    expect(formatBrokerPhone("123")).toBeNull();
    expect(formatBrokerPhone(null)).toBeNull();
  });

  it("is a lead event that needs the 24 h window or a Meta template, with the default text filled", () => {
    const event = getMessageEventByPurpose(LEAD_BROKER_INTRO_PURPOSE);
    expect(event).toMatchObject({ key: "LEAD_BROKER_INTRODUCTION", audience: "lead", windowRule: "meta_required_without_window" });
    const variables = leadBrokerIntroVariables({ leadName: "Wânia Souza", brokerName: "Renan Lima Costa", brokerPhone: "(21) 99999-8888", companyName: "Âncora Saúde" });
    expect(variables).toEqual(["Wânia", "Renan Lima", "(21) 99999-8888", "Âncora Saúde"]);
    const text = renderEventFreeMessage(event!, event!.defaultFreeMessage!, variables);
    expect(text).toContain("Oi, Wânia! Boa notícia: seu atendimento já tem um especialista dedicado.");
    expect(text).toContain("*Renan Lima*, da *Âncora Saúde*, vai cuidar de tudo pra você");
    expect(text).toContain("pelo número *(21) 99999-8888*");
    expect(text).not.toMatch(/\{\{|[—–]/);
  });
});

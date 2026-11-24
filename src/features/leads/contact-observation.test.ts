import { describe, expect, it } from "vitest";

import { cleanObservation, missingContactObservation, stageChangeTimelineText } from "./contact-observation";
import { LEAD_STATUS_LABELS, LEAD_STATUS_ORDER, VALID_TRANSITIONS } from "./lead-status-constants";
import { leadStatusValues } from "@/shared/db/schema";

describe("Entrei em contato (24/11)", () => {
  it("is a stage of the funnel right after Em atendimento", () => {
    expect(leadStatusValues.indexOf("contacted")).toBe(leadStatusValues.indexOf("in_contact") + 1);
    expect(LEAD_STATUS_ORDER.contacted).toBeGreaterThan(LEAD_STATUS_ORDER.in_contact!);
    expect(LEAD_STATUS_ORDER.contacted).toBeLessThan(LEAD_STATUS_ORDER.quote_sent!);
    expect(LEAD_STATUS_LABELS.contacted).toBe("Entrei em Contato");
  });

  it("is reachable from every open stage and can be registered again for a new contact", () => {
    for (const from of ["new", "distributed", "in_contact", "quote_sent", "negotiation", "awaiting_reply", "lost"]) {
      expect(VALID_TRANSITIONS[from]).toContain("contacted");
    }
    expect(VALID_TRANSITIONS.contacted).toContain("contacted");
    expect(VALID_TRANSITIONS.contacted).toContain("quote_sent");
  });

  it("asks a person for the account of the contact, but not the IA or a rule", () => {
    expect(missingContactObservation({ newStatus: "contacted", observation: null, bySystem: false })).toBe(true);
    expect(missingContactObservation({ newStatus: "contacted", observation: cleanObservation("   "), bySystem: false })).toBe(true);
    expect(missingContactObservation({ newStatus: "contacted", observation: "Liguei e ela pediu cotação", bySystem: false })).toBe(false);
    expect(missingContactObservation({ newStatus: "contacted", observation: null, bySystem: true })).toBe(false);
    expect(missingContactObservation({ newStatus: "quote_sent", observation: null, bySystem: false })).toBe(false);
  });

  it("writes the account of the contact in the timeline", () => {
    expect(stageChangeTimelineText({ previousStatus: "in_contact", newStatus: "contacted", observation: "Liguei, pediu cotação para 3 vidas" }))
      .toBe("Status alterado: Em Atendimento → Entrei em Contato. Como foi o contato: Liguei, pediu cotação para 3 vidas");
    expect(stageChangeTimelineText({ previousStatus: "contacted", newStatus: "contacted", observation: "Retornei, vai decidir amanhã" }))
      .toBe("Novo contato registrado. Como foi o contato: Retornei, vai decidir amanhã");
  });

  it("keeps the old text for other stages and adds a note when there is one", () => {
    expect(stageChangeTimelineText({ previousStatus: "in_contact", newStatus: "quote_sent", observation: null }))
      .toBe("Status alterado: Em Atendimento → Cotação Enviada.");
    expect(stageChangeTimelineText({ previousStatus: "quote_sent", newStatus: "negotiation", observation: "Comparando duas operadoras" }))
      .toBe("Status alterado: Cotação Enviada → Negociação. Observação: Comparando duas operadoras");
  });
});

import { describe, expect, it } from "vitest";

import { canRevealLightContact, lightContactFields, redactClientInfo } from "./lead-contact-privacy";

const lead = { telefone: "11999998888", email: "ana@example.test" };

describe("Light lead contact privacy", () => {
  it("hides phone and e-mail while the lead is new for the broker", () => {
    for (const status of ["distributed", "new"]) {
      expect(lightContactFields(lead, { status, isCurrentBroker: true })).toEqual({ reveal: false, telefone: null, email: null });
    }
  });

  it("hides contact when the lead belongs to another broker, even after acceptance", () => {
    expect(canRevealLightContact({ status: "in_contact", isCurrentBroker: false })).toBe(false);
    expect(lightContactFields(lead, { status: "in_contact", isCurrentBroker: false }).telefone).toBeNull();
  });

  it("reveals phone and e-mail after the logged broker accepted the lead", () => {
    for (const status of ["in_contact", "quote_sent", "negotiation", "documentation_pending", "converted"]) {
      expect(lightContactFields(lead, { status, isCurrentBroker: true })).toEqual({ reveal: true, ...lead });
    }
  });

  it("drops client-info rows that could carry contact data", () => {
    const items = [
      { key: "email", label: "E-mail", value: "ana@example.test" },
      { key: "whatsapp", label: "WhatsApp", value: "11999998888" },
      { key: "telefoneAlternativo", label: "Outro número", value: "11" },
      { key: "city", label: "Cidade", value: "Santos" },
      { key: "planType", label: "Plano", value: "PME" },
    ];
    expect(redactClientInfo(items).map((item) => item.key)).toEqual(["city", "planType"]);
  });
});

import { describe, expect, it } from "vitest";

import { getMetaWhatsAppTemplate, getMetaWhatsAppTemplateVariables } from "./templates";

describe("approved Meta WhatsApp templates", () => {
  it("uses the approved new-lead template for broker offers", () => {
    expect(getMetaWhatsAppTemplate("newLeadAssignment")).toEqual({ name: "novo_lead_", language: "pt_BR" });
  });

  it("does not send body variables to the static broker invitation template", () => {
    expect(getMetaWhatsAppTemplateVariables("brokerInvitation", ["Nome", "Empresa", "Cargo"])).toEqual([]);
  });

  it("preserves variables for templates that use body placeholders", () => {
    expect(getMetaWhatsAppTemplateVariables("newLeadAssignment", ["Corretor"])).toEqual(["Corretor"]);
  });
});

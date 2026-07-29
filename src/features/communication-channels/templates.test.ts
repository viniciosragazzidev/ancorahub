import { describe, expect, it } from "vitest";

import { getMetaWhatsAppTemplate, getMetaWhatsAppTemplateVariableNames } from "./templates";

describe("approved Meta WhatsApp templates", () => {
  it("uses the approved new-lead template for broker offers", () => {
    expect(getMetaWhatsAppTemplate("newLeadAssignment")).toEqual({ name: "novo_lead_", language: "pt_BR" });
  });

  it("maps the named body variables configured for the broker invitation template", () => {
    expect(getMetaWhatsAppTemplateVariableNames("brokerInvitation")).toEqual(["nome", "empresa", "cargo"]);
  });

  it("keeps positional templates without named parameter metadata", () => {
    expect(getMetaWhatsAppTemplateVariableNames("newLeadAssignment")).toBeUndefined();
  });
});

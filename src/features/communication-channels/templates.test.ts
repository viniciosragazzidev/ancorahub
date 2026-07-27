import { describe, expect, it } from "vitest";

import { getMetaWhatsAppTemplate } from "./templates";

describe("approved Meta WhatsApp templates", () => {
  it("uses the approved new-lead template for broker offers", () => {
    expect(getMetaWhatsAppTemplate("newLeadAssignment")).toEqual({ name: "novo_lead_", language: "pt_BR" });
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({
  getDatabase: vi.fn(),
  schema: {},
}));

import { WhatsAppTemplateResolver } from "./template-sync-service";

describe("WhatsAppTemplateResolver", () => {
  it("never applies a configurable qualification binding to a broker assignment", async () => {
    await expect(WhatsAppTemplateResolver.resolveTemplateForEvent("tenant-id", "brokerLeadNotification")).resolves.toEqual({
      name: "new_lead_broker",
      language: "pt_BR",
      isCustom: false,
    });
  });

  it("keeps the accepted-offer confirmation on its approved template", async () => {
    await expect(WhatsAppTemplateResolver.resolveTemplateForEvent("tenant-id", "leadAssignmentConfirmed")).resolves.toEqual({
      name: "lead_assignment_confirmed",
      language: "pt_BR",
      isCustom: false,
    });
  });
});

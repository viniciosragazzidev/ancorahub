import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({
  getDatabase: vi.fn(),
  schema: {},
}));

import { WhatsAppTemplateResolver } from "./template-sync-service";

describe("WhatsAppTemplateResolver", () => {
  it("keeps the homologated fallback when the database is unavailable", async () => {
    const { getDatabase } = await import("@/shared/db");
    vi.mocked(getDatabase).mockImplementation(() => { throw new Error("database unavailable"); });
    await expect(WhatsAppTemplateResolver.resolveTemplateForEvent("tenant-id", "brokerLeadNotification")).resolves.toEqual({
      name: "new_lead_broker", language: "pt_BR", isCustom: false,
    });
  });

  it("keeps broker invitations on the broker_first_access fallback", async () => {
    const { getDatabase } = await import("@/shared/db");
    vi.mocked(getDatabase).mockImplementation(() => { throw new Error("database unavailable"); });
    await expect(WhatsAppTemplateResolver.resolveTemplateForEvent("tenant-id", "brokerInvitation")).resolves.toEqual({
      name: "broker_first_access", language: "pt_BR", isCustom: false,
    });
  });
});

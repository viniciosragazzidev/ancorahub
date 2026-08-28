import { describe, expect, it } from "vitest";

import { buildOfficialTenantConversations } from "./official-tenant-conversations";

describe("buildOfficialTenantConversations", () => {
  it("shows a message from the tenant Meta number as an authorized official conversation", () => {
    const conversations = buildOfficialTenantConversations(
      [
        {
          id: "channel-1",
          source: "channel",
          name: "WhatsApp oficial",
          phone: "+55 (11) 99999-0000",
        },
      ],
      [
        {
          id: "message-1",
          body: "Teste",
          direction: "incoming",
          sentAt: "2026-08-20T20:00:00.000Z",
          phone: "5511999990000",
        },
      ],
    );

    expect(conversations).toEqual([
      expect.objectContaining({
        id: "tenant-channel:channel-1",
        sendTarget: { kind: "tenant_channel", channelId: "channel-1" },
        latestMessage: expect.objectContaining({ body: "Teste" }),
      }),
    ]);
  });
});

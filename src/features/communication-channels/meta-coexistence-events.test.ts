import { describe, expect, it } from "vitest";

import { COEXISTENCE_WEBHOOK_FIELDS, countStateSyncContacts, readHistory, readMessageEchoes, readPartnerRemoved } from "./meta-coexistence-events";

describe("WhatsApp Business app coexistence events", () => {
  it("routes only the coexistence fields, never the customer messages field", () => {
    expect([...COEXISTENCE_WEBHOOK_FIELDS].sort()).toEqual(["account_update", "history", "smb_app_state_sync", "smb_message_echoes"]);
    expect(COEXISTENCE_WEBHOOK_FIELDS.has("messages")).toBe(false);
  });

  it("reads a message sent from the app as the business writing to the customer", () => {
    expect(readMessageEchoes({ message_echoes: [
      { from: "5521973507276", to: "5521999998888", id: "wamid.1", timestamp: "1790000000", type: "text", text: { body: " Oi, tudo bem? " } },
      { from: "5521973507276", to: "5521999998888", id: "wamid.2", timestamp: "1790000001", type: "image", image: { caption: "Tabela" } },
      { from: "5521973507276", to: "", id: "wamid.3", type: "text", text: { body: "sem destino" } },
    ] })).toEqual([
      { providerMessageId: "wamid.1", customerPhone: "5521999998888", direction: "outgoing", body: "Oi, tudo bem?", sentAt: new Date(1790000000 * 1000) },
      { providerMessageId: "wamid.2", customerPhone: "5521999998888", direction: "outgoing", body: "[image] Tabela", sentAt: new Date(1790000001 * 1000) },
    ]);
  });

  it("tells who wrote each past message by the business number", () => {
    const history = readHistory({ history: [{
      metadata: { phase: 0, chunk_order: 1, progress: 100 },
      threads: [{ id: "5521999998888", messages: [
        { from: "5521999998888", id: "h.1", timestamp: "1780000000", type: "text", text: { body: "Quero um plano" } },
        { from: "5521973507276", to: "5521999998888", id: "h.2", timestamp: "1780000060", type: "text", text: { body: "Claro!" } },
      ] }],
    }] }, "+55 21 97350-7276");
    expect(history.progress).toBe(100);
    expect(history.errors).toEqual([]);
    expect(history.messages.map((message) => [message.providerMessageId, message.direction])).toEqual([["h.1", "incoming"], ["h.2", "outgoing"]]);
  });

  it("reports a history the business chose not to share", () => {
    const history = readHistory({ history: [{ errors: [{ code: 2593109, title: "History sync is turned off by the business from the WhatsApp Business App" }] }] }, null);
    expect(history.messages).toEqual([]);
    expect(history.errors).toEqual(["History sync is turned off by the business from the WhatsApp Business App"]);
  });

  it("counts contacts and reads a disconnection from the app", () => {
    expect(countStateSyncContacts({ state_sync: [{ type: "contact" }, { type: "contact" }, { type: "other" }] })).toBe(2);
    expect(readPartnerRemoved({ event: "PARTNER_REMOVED", phone_number: "+55 21 97350-7276" })).toEqual({ phone: "5521973507276" });
    expect(readPartnerRemoved({ event: "VERIFIED_ACCOUNT" })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { isValidConversationCursor, mergeConversationIncrementalUpdates, parseSyntheticConversationPhone } from "./incremental-sync";

type Message = { id: string; sentAt: string; direction: string; providerStatus: string | null };
type Conversation = {
  id: string;
  nome: string;
  latestMessage: { body: string; direction: string; sentAt: string } | null;
  messageCount?: number;
  hasIncoming?: boolean;
  messages: Message[];
};

const at = (second: number) => new Date(Date.UTC(2026, 10, 14, 12, 0, second)).toISOString();
const message = (id: string, second: number, overrides: Partial<Message> = {}): Message => ({
  id, sentAt: at(second), direction: "incoming", providerStatus: null, ...overrides,
});

describe("conversation incremental merge", () => {
  it("updates only the server-scoped item, deduplicates and orders messages, and preserves local lead fields", () => {
    const first: Conversation = {
      id: "lead-a",
      nome: "Ana",
      latestMessage: { body: "Antes", direction: "incoming", sentAt: at(1) },
      messageCount: 4,
      hasIncoming: true,
      messages: [message("m1", 1)],
    };
    const untouched: Conversation = {
      id: "lead-b",
      nome: "Bia",
      latestMessage: { body: "Oi", direction: "incoming", sentAt: at(2) },
      messageCount: 2,
      hasIncoming: true,
      messages: [message("b1", 2)],
    };

    const result = mergeConversationIncrementalUpdates([first, untouched], [{
      id: "lead-a",
      latestMessage: { body: "Nova", direction: "incoming", sentAt: at(3) },
      messageCount: 5,
      hasIncoming: true,
      messages: [message("m1", 1), message("m2", 3)],
      messageStatuses: [{ id: "m1", providerStatus: "read" }],
    }], { openConversationId: "lead-a" });

    expect(result.missingIds).toEqual([]);
    expect(result.conversations[0]).toMatchObject({
      id: "lead-a",
      nome: "Ana",
      latestMessage: { body: "Nova" },
      messageCount: 5,
      messages: [message("m1", 1, { providerStatus: "read" }), message("m2", 3)],
    });
    expect(result.conversations.find((item) => item.id === "lead-b")).toEqual(untouched);
  });

  it("reports an unseen conversation instead of inserting a row without server metadata", () => {
    const result = mergeConversationIncrementalUpdates< Message, Conversation >([], [{
      id: "lead-outside-current-list",
      latestMessage: { body: "", direction: "incoming", sentAt: at(1) },
      messageCount: 1,
      hasIncoming: true,
    }]);
    expect(result.missingIds).toEqual(["lead-outside-current-list"]);
    expect(result.conversations).toEqual([]);
  });

  it("can merge delivery statuses for the open thread without replacing list metadata", () => {
    const current: Conversation = {
      id: "lead-a",
      nome: "Ana",
      latestMessage: { body: "Preview", direction: "outgoing", sentAt: at(2) },
      messageCount: 8,
      hasIncoming: true,
      messages: [message("sent", 2, { direction: "outgoing", providerStatus: "sent" })],
    };
    const result = mergeConversationIncrementalUpdates([current], [{
      id: "lead-a",
      messageStatuses: [{ id: "sent", providerStatus: "read" }],
    }], { openConversationId: "lead-a" });

    expect(result.conversations[0]).toMatchObject({
      latestMessage: current.latestMessage,
      messageCount: 8,
      messages: [message("sent", 2, { direction: "outgoing", providerStatus: "read" })],
    });
  });

  it("accepts only recent, well-formed server cursors", () => {
    const now = Date.parse("2026-11-14T12:00:00.000Z");
    expect(isValidConversationCursor({ sentAt: "2026-11-14T11:59:00.000Z", id: "m1" }, now)).toBe(true);
    expect(isValidConversationCursor({ sentAt: "not-a-date", id: "m1" }, now)).toBe(false);
    expect(isValidConversationCursor({ sentAt: "2026-11-14T11:50:00.000Z", id: "m1" }, now)).toBe(false);
    expect(isValidConversationCursor({ sentAt: "2026-11-14T12:01:00.000Z", id: "m1" }, now)).toBe(false);
  });

  it("accepts a full phone only from a well-formed synthetic conversation id", () => {
    expect(parseSyntheticConversationPhone("unassigned-5521999991234")).toBe("5521999991234");
    expect(parseSyntheticConversationPhone("unassigned-55 (21) 99999-1234")).toBe("5521999991234");
    expect(parseSyntheticConversationPhone("unassigned-123")).toBeNull();
    expect(parseSyntheticConversationPhone("lead-5521999991234")).toBeNull();
  });
});

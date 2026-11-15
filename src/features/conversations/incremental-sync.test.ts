import { describe, expect, it } from "vitest";

import {
  isValidConversationCursor,
  mergeConversationIncrementalUpdates,
  parseSyntheticConversationPhone,
  pickConversationSnapshotCursor,
  shouldRefreshAfterConversationNetworkError,
  shouldRefreshConversationServer,
} from "./incremental-sync";

type Message = { id: string; sentAt: string; direction: string; providerStatus: string | null };
type Conversation = {
  id: string;
  nome: string;
  latestMessage: { body: string; direction: string; sentAt: string } | null;
  messageCount?: number;
  hasIncoming?: boolean;
  aiConversation?: {
    id: string;
    status: string;
    assignedUserId: string | null;
    aiModel: string | null;
    transferReason: string | null;
    qualificationSummary: string | null;
  } | null;
  messages: Message[];
};

const at = (second: number) => new Date(Date.UTC(2026, 10, 14, 12, 0, second)).toISOString();
const message = (id: string, second: number, overrides: Partial<Message> = {}): Message => ({
  id, sentAt: at(second), direction: "incoming", providerStatus: null, ...overrides,
});

describe("conversation incremental merge", () => {
  it("starts at the last indexed tuple so the first empty sync does not count a recent message twice", () => {
    const snapshotCursor = pickConversationSnapshotCursor(
      { sentAt: "2026-11-14T12:00:05.123Z", id: "recent-message" },
      [],
      new Date("2026-11-14T12:00:10.000Z"),
    );
    const current: Conversation = {
      id: "lead-a",
      nome: "Ana",
      latestMessage: { body: "Recente", direction: "incoming", sentAt: snapshotCursor.sentAt },
      messageCount: 1,
      hasIncoming: true,
      messages: [{ id: snapshotCursor.id, sentAt: snapshotCursor.sentAt, direction: "incoming", providerStatus: null }],
    };

    const firstSync = mergeConversationIncrementalUpdates([current], [], { openConversationId: null });

    expect(snapshotCursor).toEqual({ sentAt: "2026-11-14T12:00:05.123Z", id: "recent-message" });
    expect(firstSync.conversations[0]?.messageCount).toBe(1);
  });

  it("uses the message id to choose the maximum tuple after millisecond normalization", () => {
    expect(pickConversationSnapshotCursor(
      { sentAt: "2026-11-14T12:00:05.123Z", id: "m-10" },
      [{ sentAt: "2026-11-14T12:00:05.123456Z", id: "m-11" }],
      new Date("2026-11-14T12:00:10.000Z"),
    )).toEqual({ sentAt: "2026-11-14T12:00:05.123Z", id: "m-11" });
  });

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
      messageCountDelta: 1,
      hasIncomingDelta: true,
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
      messageCountDelta: 1,
      hasIncomingDelta: true,
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

  it("sums only cursor increments and merges AI status without clearing existing context", () => {
    const current: Conversation = {
      id: "lead-a",
      nome: "Ana",
      latestMessage: { body: "Atual", direction: "incoming", sentAt: at(2) },
      messageCount: 40,
      hasIncoming: false,
      aiConversation: {
        id: "ai-1",
        status: "AI_ACTIVE",
        assignedUserId: null,
        aiModel: "haiku",
        transferReason: "contexto preservado",
        qualificationSummary: "resumo preservado",
      },
      messages: [],
    };
    const result = mergeConversationIncrementalUpdates([current], [{
      id: "lead-a",
      messageCountDelta: 2,
      hasIncomingDelta: true,
      aiConversationStatus: { id: "ai-1", status: "HUMAN_ACTIVE", assignedUserId: "user-1" },
    }]);

    expect(result.conversations[0]).toMatchObject({
      messageCount: 42,
      hasIncoming: true,
      aiConversation: {
        id: "ai-1",
        status: "HUMAN_ACTIVE",
        assignedUserId: "user-1",
        aiModel: "haiku",
        transferReason: "contexto preservado",
        qualificationSummary: "resumo preservado",
      },
    });
  });

  it("accepts only recent, well-formed server cursors", () => {
    const now = Date.parse("2026-11-14T12:00:00.000Z");
    expect(isValidConversationCursor({ sentAt: "2026-11-14T11:59:00.000Z", id: "m1" }, now)).toBe(true);
    expect(isValidConversationCursor({ sentAt: "not-a-date", id: "m1" }, now)).toBe(false);
    expect(isValidConversationCursor({ sentAt: "2026-11-14T11:50:00.000Z", id: "m1" }, now)).toBe(false);
    expect(isValidConversationCursor({ sentAt: "2026-11-14T12:01:00.000Z", id: "m1" }, now)).toBe(false);
  });

  it("refreshes fully only while realtime is down or after ten minutes without a signal", () => {
    expect(shouldRefreshConversationServer({ realtimeLive: true, lastFullRefreshAt: 0, lastSignalAt: 100, now: 599_999 })).toBe(false);
    expect(shouldRefreshConversationServer({ realtimeLive: true, lastFullRefreshAt: 0, lastSignalAt: 100, now: 600_100 })).toBe(true);
    expect(shouldRefreshConversationServer({ realtimeLive: false, lastFullRefreshAt: 0, lastSignalAt: 100, now: 119_999 })).toBe(false);
    expect(shouldRefreshConversationServer({ realtimeLive: false, lastFullRefreshAt: 0, lastSignalAt: 100, now: 120_000 })).toBe(true);
  });

  it("throttles full refreshes caused by repeated network errors to one per minute", () => {
    expect(shouldRefreshAfterConversationNetworkError(null, 10_000)).toBe(true);
    expect(shouldRefreshAfterConversationNetworkError(10_000, 69_999)).toBe(false);
    expect(shouldRefreshAfterConversationNetworkError(10_000, 70_000)).toBe(true);
  });

  it("accepts a full phone only from a well-formed synthetic conversation id", () => {
    expect(parseSyntheticConversationPhone("unassigned-5521999991234")).toBe("5521999991234");
    expect(parseSyntheticConversationPhone("unassigned-55 (21) 99999-1234")).toBe("5521999991234");
    expect(parseSyntheticConversationPhone("unassigned-123")).toBeNull();
    expect(parseSyntheticConversationPhone("lead-5521999991234")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { conversationKey, pickMessageIdsToLoad, summarizeIndexRows, type MessageIndexRow } from "./message-window";

const at = (minute: number) => new Date(Date.UTC(2026, 9, 26, 12, minute));
const row = (id: string, minute: number, overrides: Partial<MessageIndexRow> = {}): MessageIndexRow => ({
  id, leadId: null, clientId: null, phone: null, direction: "inbound", sentAt: at(minute), communicationChannelId: null, ...overrides,
});

describe("conversation key", () => {
  it("groups by lead, otherwise by the last 8 phone digits", () => {
    expect(conversationKey({ leadId: "l1", phone: "5511999990000" })).toBe("lead:l1");
    expect(conversationKey({ leadId: null, phone: "+55 (11) 99999-0000" })).toBe("phone:99990000");
    expect(conversationKey({ leadId: null, phone: "123" })).toBeNull();
  });
});

describe("messages loaded in full", () => {
  it("keeps only the newest few of each conversation for the list", () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, i) => row(`a${i}`, i, { leadId: "lead-a" })),
      ...Array.from({ length: 2 }, (_, i) => row(`b${i}`, i, { phone: "5511988887777" })),
    ];
    expect(pickMessageIdsToLoad(rows).sort()).toEqual(["a7", "a8", "a9", "b0", "b1"]);
  });

  it("adds the open conversation's history by lead and by the same phone, capped", () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, i) => row(`a${i}`, i, { leadId: "lead-a" })),
      row("p1", 20, { phone: "+55 11 97777-6666" }),
      row("other", 30, { leadId: "lead-b" }),
    ];
    const ids = pickMessageIdsToLoad(rows, { openThread: { leadId: "lead-a", phone: "5511977776666" }, openThreadLimit: 6 });
    // The open thread: p1 (same phone) plus a9..a5 (6 newest); lead-b keeps its preview.
    expect(ids).toEqual(expect.arrayContaining(["p1", "a9", "a8", "a7", "a6", "a5", "other"]));
    expect(ids).not.toContain("a4");
  });

  it("opens a conversation without a lead by its phone", () => {
    const rows = Array.from({ length: 6 }, (_, i) => row(`u${i}`, i, { phone: "5521911112222" }));
    expect(pickMessageIdsToLoad(rows, { openThread: { leadId: null, phone: "5521911112222" } })).toHaveLength(6);
  });
});

describe("index summary", () => {
  it("counts unique messages and spots an incoming one", () => {
    expect(summarizeIndexRows([row("1", 1, { direction: "outbound" }), row("1", 1, { direction: "outbound" }), row("2", 2, { direction: "outgoing" })]))
      .toEqual({ messageCount: 2, hasIncoming: false });
    expect(summarizeIndexRows([row("1", 1, { direction: "outbound" }), row("2", 2, { direction: "inbound" })]).hasIncoming).toBe(true);
  });
});

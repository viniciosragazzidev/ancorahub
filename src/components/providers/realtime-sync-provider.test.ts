import { describe, expect, it } from "vitest";

import { shouldDelayRealtimeUnavailable, shouldScheduleShellRefresh } from "./realtime-sync-provider";

describe("shouldScheduleShellRefresh", () => {
  it("avoids a duplicate shell refresh when the conversation workspace owns the update", () => {
    expect(shouldScheduleShellRefresh(
      { kind: "domain.invalidated", domain: "conversations" },
      "/conversas/broker",
    )).toBe(false);
  });

  it("keeps the shell fallback for other domains and dashboard summaries", () => {
    expect(shouldScheduleShellRefresh(
      { kind: "domain.invalidated", domain: "leads" },
      "/leads",
    )).toBe(true);
    expect(shouldScheduleShellRefresh(
      { kind: "domain.invalidated", domain: "conversations" },
      "/dashboard",
    )).toBe(true);
  });

  it("waits for a reconnect window before reporting the realtime channel unavailable", () => {
    expect(shouldDelayRealtimeUnavailable("CHANNEL_ERROR")).toBe(true);
    expect(shouldDelayRealtimeUnavailable("TIMED_OUT")).toBe(true);
    expect(shouldDelayRealtimeUnavailable("SUBSCRIBED")).toBe(false);
    expect(shouldDelayRealtimeUnavailable("CLOSED")).toBe(false);
  });
});

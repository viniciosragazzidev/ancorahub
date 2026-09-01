import { describe, expect, it, vi } from "vitest";

import { shouldDelayRealtimeUnavailable, shouldScheduleShellRefresh } from "./realtime-sync-provider";
import { logSupabaseRealtimeDiagnostic } from "@/utils/supabase/client";

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

describe("Supabase Realtime diagnostics", () => {
  it("does not emit diagnostics unless explicitly enabled", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const previous = process.env.NEXT_PUBLIC_REALTIME_DIAGNOSTICS;
    process.env.NEXT_PUBLIC_REALTIME_DIAGNOSTICS = "false";

    logSupabaseRealtimeDiagnostic({ event: "subscription_status", status: "CHANNEL_ERROR", errorPresent: true });

    expect(info).not.toHaveBeenCalled();
    if (previous === undefined) delete process.env.NEXT_PUBLIC_REALTIME_DIAGNOSTICS;
    else process.env.NEXT_PUBLIC_REALTIME_DIAGNOSTICS = previous;
    info.mockRestore();
  });
});

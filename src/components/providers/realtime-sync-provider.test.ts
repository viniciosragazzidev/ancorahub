import { describe, expect, it, vi } from "vitest";

import { REFRESH_COALESCE_MS, RESUME_REFRESH_AFTER_MS, shouldDelayRealtimeUnavailable, shouldRefreshOnResume, shouldScheduleShellRefresh } from "./realtime-sync-provider";
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

  it("refreshes only routes that display conversation data", () => {
    const conversationEvent = { kind: "domain.invalidated", domain: "conversations" } as const;

    expect(shouldScheduleShellRefresh(conversationEvent, "/dashboard")).toBe(true);
    expect(shouldScheduleShellRefresh(conversationEvent, "/leads/lead-1")).toBe(true);
    expect(shouldScheduleShellRefresh(conversationEvent, "/mensagens/lead-1")).toBe(true);
    expect(shouldScheduleShellRefresh(conversationEvent, "/minha-fila")).toBe(true);
    expect(shouldScheduleShellRefresh(conversationEvent, "/equipe/minha")).toBe(false);
    expect(shouldScheduleShellRefresh(conversationEvent, "/settings")).toBe(false);
  });

  it("refreshes WhatsApp connection screens without refreshing unrelated pages", () => {
    const connectionEvent = { kind: "domain.invalidated", domain: "whatsapp_connection" } as const;

    expect(shouldScheduleShellRefresh(connectionEvent, "/settings")).toBe(true);
    expect(shouldScheduleShellRefresh(connectionEvent, "/integrations/whatsapp")).toBe(true);
    expect(shouldScheduleShellRefresh(connectionEvent, "/leads/lead-1")).toBe(false);
  });

  it("coalesces realtime refreshes within 1.5 seconds", () => {
    expect(REFRESH_COALESCE_MS).toBe(1_500);
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

describe("shouldRefreshOnResume", () => {
  it("re-reads the server view after the tab stayed hidden long enough to miss signals", () => {
    expect(shouldRefreshOnResume(1_000, 1_000 + RESUME_REFRESH_AFTER_MS)).toBe(true);
  });

  it("skips quick tab switches and first loads", () => {
    expect(shouldRefreshOnResume(1_000, 1_000 + RESUME_REFRESH_AFTER_MS - 1)).toBe(false);
    expect(shouldRefreshOnResume(null, 50_000)).toBe(false);
  });
});

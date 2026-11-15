import type { RealtimeSyncBrowserDetail } from "@/components/providers/realtime-events";
import { isConversationSummaryRefresh, shouldScheduleShellRefresh } from "@/components/providers/realtime-sync-provider";

/** Minimum time between two rail loads (Supabase egress, 03/11: was 3 s). */
export const RAIL_REFRESH_MS = 10_000;

export type RailRealtimeDecision = "load" | "defer" | "skip";

/**
 * What the desktop chat rail does with a realtime signal:
 * - skip: the layout already renders the rail (manager Lite) and this signal
 *   refreshes the layout now, so loading /api/chat/rail too would read it twice
 *   (a conversation signal on /dashboard or /leads refreshes the layout only once
 *   a minute, egress 15/11, so the rail loads by itself there);
 * - defer: the tab is hidden, the load waits for the tab to come back;
 * - load: fetch /api/chat/rail (throttled by RAIL_REFRESH_MS).
 */
export function railRealtimeDecision(input: {
  detail: RealtimeSyncBrowserDetail | null;
  pathname: string;
  serverRendersRail: boolean;
  visible: boolean;
}): RailRealtimeDecision {
  const layoutRefreshesNow = !input.detail
    || (shouldScheduleShellRefresh(input.detail, input.pathname) && !isConversationSummaryRefresh(input.detail, input.pathname));
  if (input.serverRendersRail && layoutRefreshesNow) return "skip";
  return input.visible ? "load" : "defer";
}

export function railLoadDelay(lastLoadAt: number, now: number) {
  return Math.max(0, RAIL_REFRESH_MS - (now - lastLoadAt));
}

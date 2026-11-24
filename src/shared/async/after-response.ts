import "server-only";

import { after } from "next/server";

import { runInBackgroundPool } from "@/shared/db/background-pool";

/**
 * Runs a non-critical, durable follow-up only after the Server Action response
 * has been sent. The durable queue remains the source of truth: a failed
 * best-effort attempt is recovered by the scheduled worker.
 * It runs on the background pool so it never waits for, or holds, the
 * connections that render the screens.
 */
export function scheduleAfterResponse(label: string, task: () => Promise<unknown>) {
  after(() => runInBackgroundPool(async () => {
    try {
      await task();
    } catch (error) {
      const message = error instanceof Error ? error.message.replace(/[\r\n]+/g, " ").slice(0, 180) : "unknown_error";
      console.error("[after-response] follow-up failed", { label, message });
    }
  }));
}

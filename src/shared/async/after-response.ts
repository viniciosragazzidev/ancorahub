import "server-only";

import { after } from "next/server";

/**
 * Runs a non-critical, durable follow-up only after the Server Action response
 * has been sent. The durable queue remains the source of truth: a failed
 * best-effort attempt is recovered by the scheduled worker.
 */
export function scheduleAfterResponse(label: string, task: () => Promise<unknown>) {
  after(async () => {
    try {
      await task();
    } catch (error) {
      const message = error instanceof Error ? error.message.replace(/[\r\n]+/g, " ").slice(0, 180) : "unknown_error";
      console.error("[after-response] follow-up failed", { label, message });
    }
  });
}

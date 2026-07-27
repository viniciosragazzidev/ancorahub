import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPushTrackerForTest,
  MAX_INDIVIDUAL_PUSHES_IN_WINDOW,
  PUSH_COALESCE_WINDOW_MS,
} from "./send-push-helper";

describe("push-notification-coalescing", () => {
  afterEach(() => {
    clearPushTrackerForTest();
    vi.restoreAllMocks();
  });

  it("defines 60 seconds coalesce window and max 2 individual pushes limit", () => {
    expect(PUSH_COALESCE_WINDOW_MS).toBe(60000);
    expect(MAX_INDIVIDUAL_PUSHES_IN_WINDOW).toBe(2);
  });
});

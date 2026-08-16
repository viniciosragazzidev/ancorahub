import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resolveSystemUserId } from "./system-user";

describe("resolveSystemUserId", () => {
  it("returns fallback system string when database contains no user or fails", async () => {
    const result = await resolveSystemUserId("tenant-test-id");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

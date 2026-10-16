import { afterEach, describe, expect, it, vi } from "vitest";

import { safeLoad } from "./safe-load";

afterEach(() => vi.restoreAllMocks());

describe("safeLoad", () => {
  it("returns the value when the read works", async () => {
    expect(await safeLoad("test", async () => [1, 2])).toEqual({ ok: true, value: [1, 2] });
  });

  it("reports a missing table so the page can say a migration is pending", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const missing = Object.assign(new Error('relation "waha_group_sources" does not exist'), { code: "42P01" });

    expect(await safeLoad("test", async () => Promise.reject(new Error("Failed query", { cause: missing })))).toEqual({
      ok: false,
      missingTables: true,
    });
    expect(log).toHaveBeenCalledWith("[test] load_failed", { code: "42P01", missingTables: true });
  });

  it("does not claim a missing table for any other failure, and never logs the message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await safeLoad("test", async () => Promise.reject(new Error("senha=segredo")))).toEqual({ ok: false, missingTables: false });
    expect(JSON.stringify(log.mock.calls)).not.toContain("segredo");
  });
});

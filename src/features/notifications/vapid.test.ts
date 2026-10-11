import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// A valid pair (generated with web-push for tests only).
const PUBLIC = "BFGxJXuh-Q4OBSAulDVCt1_YbmtH7Ly0xr8MaiD9CeDJHtd0_zqv_PosPnV4blpXE8wMhICQD61HXQgCnFceUtY";
const PRIVATE = "inh2I09j9nVZ468Ilk6v0t9WhpRoMWnbZJCTZOzNbcs";

async function load() {
  vi.resetModules();
  return import("./vapid");
}

describe("vapid keys at runtime", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("turns push off instead of throwing when the key is malformed", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "not-a-key");
    vi.stubEnv("VAPID_PRIVATE_KEY", PRIVATE);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { ensureVapidConfigured } = await load();
    expect(ensureVapidConfigured()).toBe(false);
    expect(ensureVapidConfigured()).toBe(false);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("accepts a pasted value with quotes and a newline", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", `"${PUBLIC}"\n`);
    vi.stubEnv("VAPID_PRIVATE_KEY", ` ${PRIVATE} `);
    const { ensureVapidConfigured, getVapidPublicKey } = await load();
    expect(getVapidPublicKey()).toBe(PUBLIC);
    expect(ensureVapidConfigured()).toBe(true);
  });

  it("is off without keys", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    const { ensureVapidConfigured } = await load();
    expect(ensureVapidConfigured()).toBe(false);
  });
});

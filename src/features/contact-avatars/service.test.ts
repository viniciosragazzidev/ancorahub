import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ getDatabase: vi.fn(), schema: {} }));

describe("contact avatar cache key", () => {
  it("is the same contact under any formatting", async () => {
    const { avatarPhoneKey } = await import("./service");
    expect(avatarPhoneKey("+55 (24) 99333-8228")).toBe("24993338228");
    expect(avatarPhoneKey("5524993338228")).toBe("24993338228");
    expect(avatarPhoneKey("24993338228")).toBe("24993338228");
    expect(avatarPhoneKey("123")).toBe("");
  });
});

describe("new WhatsApp lookups per minute", () => {
  it("allows 20 per tenant in a minute, then waits for the minute to pass", async () => {
    const { takeAvatarLookupSlot } = await import("./service");
    const start = 1_000_000;
    for (let index = 0; index < 20; index += 1) expect(takeAvatarLookupSlot("tenant-slots", start + index)).toBe(true);
    expect(takeAvatarLookupSlot("tenant-slots", start + 30_000)).toBe(false);
    expect(takeAvatarLookupSlot("tenant-slots", start + 60_001)).toBe(true);
  });

  it("counts each tenant on its own", async () => {
    const { takeAvatarLookupSlot } = await import("./service");
    for (let index = 0; index < 20; index += 1) takeAvatarLookupSlot("tenant-full", 5_000);
    expect(takeAvatarLookupSlot("tenant-full", 5_001)).toBe(false);
    expect(takeAvatarLookupSlot("tenant-other", 5_001)).toBe(true);
  });
});

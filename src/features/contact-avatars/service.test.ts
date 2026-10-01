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

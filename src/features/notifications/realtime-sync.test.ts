import { afterEach, describe, expect, it, vi } from "vitest";

import { getRealtimeSyncTopic } from "./realtime-sync";

describe("notification realtime sync topic", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("derives a stable opaque topic for one tenant and user", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");

    const topic = getRealtimeSyncTopic({
      tenantId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
    });

    expect(topic).toMatch(/^ancorahub:sync:[A-Za-z0-9_-]{43}$/);
    expect(topic).toBe(getRealtimeSyncTopic({
      tenantId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
    }));
  });

  it("keeps tenant and user identifiers out of the topic", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
    const tenantId = "tenant-private-id";
    const userId = "user-private-id";

    const topic = getRealtimeSyncTopic({ tenantId, userId });

    expect(topic).not.toContain(tenantId);
    expect(topic).not.toContain(userId);
  });

  it("does not create a topic without the server secret", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    expect(getRealtimeSyncTopic({ tenantId: "tenant", userId: "user" })).toBeNull();
  });
});

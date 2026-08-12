import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { hashMetaConnectionState } from "./meta-connection-attempts";

describe("Meta connection authorization state", () => {
  it("stores a deterministic hash instead of the browser state", () => {
    const state = "tenant-bound-oauth-state";
    const hash = hashMetaConnectionState(state);

    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(state);
    expect(hashMetaConnectionState(state)).toBe(hash);
  });

  it("changes the database lookup value when the state is changed", () => {
    expect(hashMetaConnectionState("state-a")).not.toBe(hashMetaConnectionState("state-b"));
  });
});

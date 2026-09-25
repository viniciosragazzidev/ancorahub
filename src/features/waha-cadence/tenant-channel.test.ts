import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { tenantChannelSessionName } from "./tenant-channel";

describe("tenantChannelSessionName", () => {
  it("is one stable session per tenant, distinct from broker sessions (waha_…)", () => {
    const name = tenantChannelSessionName("d47a4d41-4e45-450d-a0b8-a9e1be286903");
    expect(name).toBe(tenantChannelSessionName("d47a4d41-4e45-450d-a0b8-a9e1be286903"));
    expect(name).toMatch(/^tenant_[0-9a-f]{16}$/);
    expect(name).not.toBe(tenantChannelSessionName("another-tenant"));
  });
});

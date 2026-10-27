import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ value: "true", calls: 0 }));

vi.mock("server-only", () => ({}));
vi.mock("@/features/system-settings/queries", () => ({
  getSystemSetting: async () => { mocked.calls += 1; return mocked.value; },
}));

import { shouldShowLiveStatusStrip } from "./flag";

beforeEach(() => {
  mocked.value = "true";
  mocked.calls = 0;
});

describe("exibição da faixa", () => {
  it("só consulta a chave para papéis com escopo operacional", async () => {
    const marketing = { tenantId: "tenant-a", userId: "user-a", role: "marketing", jobTitle: "marketing", branchId: null } as never;
    expect(await shouldShowLiveStatusStrip(marketing)).toBe(false);
    expect(mocked.calls).toBe(0);

    const director = { tenantId: "tenant-a", userId: "director-a", role: "director", jobTitle: "director", branchId: null } as never;
    expect(await shouldShowLiveStatusStrip(director)).toBe(true);
    expect(mocked.calls).toBe(1);
  });

  it("respeita a flag desligada mesmo com papel autorizado", async () => {
    mocked.value = "false";
    const director = { tenantId: "tenant-a", userId: "director-a", role: "director", jobTitle: "director", branchId: null } as never;
    expect(await shouldShowLiveStatusStrip(director)).toBe(false);
  });
});

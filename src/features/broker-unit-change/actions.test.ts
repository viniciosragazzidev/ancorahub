import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ context: vi.fn(), flag: vi.fn(), change: vi.fn(), invalidate: vi.fn(), wake: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mocks.context, invalidateTenantContextCache: mocks.invalidate }));
vi.mock("@/features/system-settings/queries", () => ({ FEATURE_FLAGS: { BROKER_SELF_UNIT_CHANGE: "unit-flag" }, getFeatureFlag: mocks.flag }));
vi.mock("@/features/lead-distribution/jobs", () => ({ wakeLeadsAwaitingEligibleBroker: mocks.wake }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("./service", () => {
  class BrokerUnitChangeError extends Error {}
  return { BrokerUnitChangeError, changeOwnBranch: mocks.change };
});

import { BrokerUnitChangeError } from "./service";
import { changeOwnBranchAction } from "./actions";

const broker = { tenantId: "tenant-1", userId: "broker-1", role: "broker", branchId: "unit-a" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue(broker);
  mocks.flag.mockResolvedValue("true");
  mocks.wake.mockResolvedValue(0);
  mocks.change.mockResolvedValue({ branchName: "Unidade B", changed: true, releasedAssignments: 1 });
});

describe("changeOwnBranchAction", () => {
  it("changes the unit of the signed-in broker and refreshes their context", async () => {
    expect(await changeOwnBranchAction("unit-b")).toEqual({ ok: true, branchName: "Unidade B", changed: true, releasedAssignments: 1 });
    // Tenant and identity come from the server context, never from the payload.
    expect(mocks.change).toHaveBeenCalledWith(broker, "unit-b");
    expect(mocks.invalidate).toHaveBeenCalledWith("broker-1");
    expect(mocks.wake).toHaveBeenCalledWith("tenant-1");
    expect(mocks.revalidate).toHaveBeenCalledWith("/settings");
  });

  it("does not invalidate anything when the unit did not change", async () => {
    mocks.change.mockResolvedValue({ branchName: "Unidade A", changed: false, releasedAssignments: 0 });
    expect((await changeOwnBranchAction("unit-a")).ok).toBe(true);
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it.each([[""], [42], [null], ["x".repeat(81)]])("rejects an invalid payload before reading the session", async (payload) => {
    expect((await changeOwnBranchAction(payload)).ok).toBe(false);
    expect(mocks.context).not.toHaveBeenCalled();
  });

  it.each(["manager", "director", "supervisor"])("denies role %s", async (role) => {
    mocks.context.mockResolvedValue({ ...broker, role });
    expect(await changeOwnBranchAction("unit-b")).toEqual({ ok: false, error: "Só o corretor pode trocar a própria unidade por aqui." });
    expect(mocks.change).not.toHaveBeenCalled();
  });

  it("is refused on the server when the flag is off", async () => {
    mocks.flag.mockResolvedValue("false");
    expect((await changeOwnBranchAction("unit-b")).ok).toBe(false);
    expect(mocks.change).not.toHaveBeenCalled();
  });

  it("shows service refusals and hides unexpected errors", async () => {
    mocks.change.mockRejectedValueOnce(new BrokerUnitChangeError("Escolha uma unidade ativa da sua corretora."));
    expect(await changeOwnBranchAction("unit-x")).toEqual({ ok: false, error: "Escolha uma unidade ativa da sua corretora." });
    mocks.change.mockRejectedValueOnce(new Error("relation does not exist"));
    expect(await changeOwnBranchAction("unit-b")).toEqual({ ok: false, error: "Não consegui trocar sua unidade agora. Tente de novo em instantes." });
  });
});

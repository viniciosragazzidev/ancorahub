import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ context: vi.fn(), flag: vi.fn(), db: { transaction: vi.fn(), select: vi.fn(), insert: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ updateTag: vi.fn() }));
vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => mocks.db }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mocks.context }));
vi.mock("@/features/system-settings/queries", () => ({ FEATURE_FLAGS: { BROKER_JOURNEY: "journey", ENGAGEMENT_CAMPAIGNS: "campaigns" }, getFeatureFlag: mocks.flag }));

import { recognizeBrokerAction } from "./recognition-actions";
import { createCampaign } from "./campaign-actions";
import { updateRule } from "./director-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({ tenantId: "tenant", userId: "member", role: "broker" });
  mocks.flag.mockResolvedValue("true");
});

describe("journey management actions", () => {
  it("rejects malformed recognition input before resolving the actor", async () => {
    expect((await recognizeBrokerAction({ brokerId: " ", points: 51, reason: "ok" })).ok).toBe(false);
    expect(mocks.context).not.toHaveBeenCalled();
  });

  it("blocks a broker from granting points", async () => {
    expect(await recognizeBrokerAction({ brokerId: "broker", points: 10, reason: "Bom atendimento" })).toMatchObject({ ok: false });
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });

  it("blocks campaign creation outside a manager, supervisor or director session", async () => {
    expect(await createCampaign({ title: "Campanha", metric: "contacts.evidenced", target: 10, bonusPoints: 20, startsAt: "2026-10-10T00:00:00-03:00", endsAt: "2026-10-12T23:59:59-03:00", audience: {} })).toMatchObject({ ok: false });
    expect(mocks.context).toHaveBeenCalledTimes(1);
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it("keeps rule changes director-only", async () => {
    expect(await updateRule({ ruleKey: "contact.first", enabled: true, points: 15, dailyCap: null })).toMatchObject({ ok: false });
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });
});

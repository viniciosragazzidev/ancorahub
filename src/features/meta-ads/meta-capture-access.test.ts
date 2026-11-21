import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantContext } from "@/shared/auth/types";

const mocks = vi.hoisted(() => ({
  context: null as unknown as TenantContext,
  insert: vi.fn(),
  setSystemSetting: vi.fn(),
}));

vi.mock("@/shared/auth/tenant-context", () => ({
  getRequiredTenantContext: vi.fn(async () => mocks.context),
}));

vi.mock("@/shared/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/db")>();
  return { ...original, getDatabase: () => ({ insert: mocks.insert }) };
});

vi.mock("@/features/system-settings/queries", () => ({
  setSystemSetting: mocks.setSystemSetting,
  getSystemSetting: vi.fn(async () => null),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  batchSetMetaCaptureEligibilityAction,
  setMetaGlobalCaptureModeAction,
  toggleMetaAdCaptureEligibilityAction,
  toggleMetaCampaignCaptureEligibilityAction,
  toggleMetaFormCaptureEligibilityAction,
} from "./actions";
import { assertMetaCaptureManager } from "./meta-capture-access";

function contextFor(role: TenantContext["role"], jobTitle: string = role, extra: Partial<TenantContext> = {}): TenantContext {
  return { userId: "user-1", tenantId: "tenant-1", role, jobTitle, branchId: null, ...extra };
}

const captureActions = {
  campaign: () => toggleMetaCampaignCaptureEligibilityAction({ campaignId: "c-1", enabled: false }),
  globalMode: () => setMetaGlobalCaptureModeAction({ mode: "disabled" }),
  ad: () => toggleMetaAdCaptureEligibilityAction({ adId: "ad-1", enabled: false }),
  form: () => toggleMetaFormCaptureEligibilityAction({ formId: "form-1", enabled: false }),
  batch: () => batchSetMetaCaptureEligibilityAction({ assetType: "ads", assetIds: ["ad-1"], enabled: false }),
};

beforeEach(() => {
  mocks.insert.mockReset();
  mocks.setSystemSetting.mockReset();
  const onConflictDoUpdate = vi.fn(async () => undefined);
  mocks.insert.mockImplementation(() => ({
    values: vi.fn(() => Object.assign(Promise.resolve(undefined), { onConflictDoUpdate })),
  }));
});

describe("captura Meta: quem pode alterar", () => {
  it.each([
    ["corretor", contextFor("broker")],
    ["supervisor", contextFor("supervisor")],
    ["diretor em \"Ver como\"", contextFor("director", "director", { viewAs: { adminUserId: "admin-1" } })],
  ])("recusa %s em todas as ações de captura, sem gravar nada", async (_label, context) => {
    mocks.context = context;
    for (const run of Object.values(captureActions)) {
      const result = await run();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/somente leitura|Apenas Diretores/);
    }
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.setSystemSetting).not.toHaveBeenCalled();
  });

  it("deixa o diretor mudar o modo mestre e a captura de anúncio, formulário e lote", async () => {
    mocks.context = contextFor("director");
    await expect(captureActions.globalMode()).resolves.toEqual({ success: true });
    expect(mocks.setSystemSetting).toHaveBeenCalledWith("meta_lead_capture_mode_tenant-1", "disabled");
    await expect(captureActions.ad()).resolves.toEqual({ success: true });
    await expect(captureActions.form()).resolves.toEqual({ success: true });
    await expect(captureActions.batch()).resolves.toMatchObject({ success: true });
    expect(mocks.insert).toHaveBeenCalled();
  });

  it("aceita gestor e cargo de marketing, como a conexão Meta", () => {
    expect(() => assertMetaCaptureManager(contextFor("manager"))).not.toThrow();
    expect(() => assertMetaCaptureManager(contextFor("broker", "marketing"))).not.toThrow();
    expect(() => assertMetaCaptureManager(contextFor("director"))).not.toThrow();
  });
});

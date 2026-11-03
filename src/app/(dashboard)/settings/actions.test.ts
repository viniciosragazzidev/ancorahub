import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ saved: [] as Array<Record<string, unknown>>, store: vi.fn<(tenantId: string, dataUrl: string) => Promise<string>>(async () => "/api/tenants/tenant-1/logo/0123456789abcdef.png") }));

vi.mock("@/shared/auth/tenant-context", () => ({
  getRequiredTenantContext: async () => ({ tenantId: "tenant-1", userId: "director-1", role: "director" }),
}));
vi.mock("@/features/tenant-branding/logo-storage", () => ({ storeTenantLogo: (tenantId: string, dataUrl: string) => state.store(tenantId, dataUrl) }));
vi.mock("@/shared/db", () => {
  const tx = {
    update: () => ({ set: (values: Record<string, unknown>) => ({ where: async () => { state.saved.push(values); } }) }),
    insert: () => ({ values: async () => undefined }),
  };
  return { getDatabase: () => ({ transaction: async (callback: (t: typeof tx) => Promise<void>) => callback(tx) }), schema: { tenants: { id: "id" }, auditLogs: {} } };
});

import { updateTenantBrandingAction } from "./actions";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const save = (logoUrl: string) => {
  const form = new FormData();
  form.set("brandColor", "#1e40af");
  form.set("logoUrl", logoUrl);
  return updateTenantBrandingAction({ success: false }, form);
};

beforeEach(() => {
  state.saved.length = 0;
  state.store.mockClear();
});

describe("identidade visual: logo no R2 (egress, 03/11)", () => {
  it("stores a new logo in R2 and keeps only its short address in the tenant row", async () => {
    await expect(save(PNG)).resolves.toEqual({ success: true });
    expect(state.store).toHaveBeenCalledWith("tenant-1", PNG);
    expect(state.saved).toEqual([expect.objectContaining({ logoUrl: "/api/tenants/tenant-1/logo/0123456789abcdef.png" })]);
  });

  it("keeps the stored logo when only the color changes", async () => {
    await expect(save("/api/tenants/tenant-1/logo/0123456789abcdef.png")).resolves.toEqual({ success: true });
    expect(state.store).not.toHaveBeenCalled();
    expect(state.saved[0]).toMatchObject({ logoUrl: "/api/tenants/tenant-1/logo/0123456789abcdef.png" });
  });

  it("refuses another company's stored logo", async () => {
    const result = await save("/api/tenants/tenant-2/logo/0123456789abcdef.png");
    expect(result.success).toBe(false);
    expect(state.saved).toHaveLength(0);
  });

  it("does not save when R2 fails for a reason other than missing configuration", async () => {
    state.store.mockRejectedValueOnce(new Error("upload 500"));
    const result = await save(PNG);
    expect(result).toEqual({ success: false, error: "Não foi possível salvar a logo agora. Tente de novo em instantes." });
    expect(state.saved).toHaveLength(0);
  });
});

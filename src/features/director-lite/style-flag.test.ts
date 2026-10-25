import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TenantContext } from "@/shared/auth/types";

const { getSystemSetting, getFeatureFlag, getExperienceMode } = vi.hoisted(() => ({
  getSystemSetting: vi.fn(),
  getFeatureFlag: vi.fn(),
  getExperienceMode: vi.fn(),
}));

vi.mock("@/features/system-settings/queries", () => ({
  getSystemSetting,
  getFeatureFlag,
  FEATURE_FLAGS: { MANAGER_LITE: "feature_manager_lite", SUPERVISOR_LITE: "feature_supervisor_lite" },
}));
vi.mock("@/features/broker-workspace/experience-mode", () => ({ getExperienceMode }));

import { directorLiteAppliesTo, directorLiteStyleSettingKey, isDirectorLitePageOnServer, isDirectorLiteStyleEnabled, shouldUseDirectorLiteStyle } from "./style-flag";
import { isDirectorLiteRouteOptedOut } from "@/components/arc/director-lite-routes";

function ctx(partial: Partial<TenantContext> & Pick<TenantContext, "role">): TenantContext {
  return { userId: "user-1", tenantId: "tenant-1", jobTitle: partial.role, branchId: null, ...partial };
}

const director = ctx({ role: "director" });
const marketing = ctx({ role: "manager", jobTitle: "marketing" });
const finance = ctx({ role: "manager", jobTitle: "finance" });
const customRole = ctx({ role: "manager", jobTitle: "manager", customRoleId: "role-custom-1" });
const normalManager = ctx({ role: "manager", branchId: "branch-1" });
const broker = ctx({ role: "broker" });
const supervisor = ctx({ role: "supervisor", supervisorTeamScope: true });

/** Liga a chave da empresa e define o modo e as flags dos Lite próprios. */
function setup({ key, mode = "NORMAL", managerLite = false, supervisorLite = false }: { key: boolean; mode?: "LIGHT" | "NORMAL"; managerLite?: boolean; supervisorLite?: boolean }) {
  getSystemSetting.mockResolvedValue(key ? "true" : undefined);
  getExperienceMode.mockResolvedValue(mode);
  getFeatureFlag.mockImplementation(async (flag: string) => {
    if (flag === "feature_manager_lite") return managerLite ? "true" : "false";
    if (flag === "feature_supervisor_lite") return supervisorLite ? "true" : "false";
    return "false";
  });
}

describe("visual Lite das telas internas (chave por empresa + modo normal)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the per-company settings key and stays off when unset", async () => {
    getSystemSetting.mockResolvedValue(undefined);

    await expect(isDirectorLiteStyleEnabled("tenant-1")).resolves.toBe(false);
    expect(directorLiteStyleSettingKey("tenant-1")).toBe("feature_director_lite_style_tenant-1");
    expect(getSystemSetting).toHaveBeenCalledWith("feature_director_lite_style_tenant-1");
  });

  it("chave desligada: falso para todos, sem consultar o modo de uso", async () => {
    setup({ key: false });
    for (const context of [director, marketing, finance, customRole, normalManager, broker, supervisor]) {
      await expect(shouldUseDirectorLiteStyle(context)).resolves.toBe(false);
    }
    expect(getExperienceMode).not.toHaveBeenCalled();
  });

  it("chave ligada: verdadeiro para diretor, marketing, financeiro, cargo personalizado e gestor no modo normal", async () => {
    setup({ key: true, mode: "NORMAL" });
    for (const context of [director, marketing, finance, customRole, normalManager]) {
      await expect(shouldUseDirectorLiteStyle(context)).resolves.toBe(true);
    }
  });

  it("chave ligada: falso para corretor, supervisor e gestor no Lite próprio (LIGHT)", async () => {
    setup({ key: true, mode: "LIGHT", managerLite: true, supervisorLite: true });
    await expect(shouldUseDirectorLiteStyle(broker)).resolves.toBe(false);
    await expect(shouldUseDirectorLiteStyle(supervisor)).resolves.toBe(false);
    await expect(shouldUseDirectorLiteStyle(normalManager)).resolves.toBe(false);
  });

  it("gestor sem o Lite de gestor continua no visual Lite das telas internas", async () => {
    setup({ key: true, mode: "NORMAL", managerLite: false });
    await expect(shouldUseDirectorLiteStyle(normalManager)).resolves.toBe(true);
  });

  it("ver como: a regra segue o papel visto (o contexto já é o do usuário visto)", async () => {
    setup({ key: true, mode: "LIGHT" });
    await expect(shouldUseDirectorLiteStyle({ ...broker, viewAs: { adminUserId: "admin-1" } })).resolves.toBe(false);
    setup({ key: true, mode: "NORMAL" });
    await expect(shouldUseDirectorLiteStyle({ ...marketing, viewAs: { adminUserId: "admin-1" } })).resolves.toBe(true);
  });

  it("a regra pura só liga com a chave e fora de um Lite próprio", () => {
    expect(directorLiteAppliesTo(false, null)).toBe(false);
    expect(directorLiteAppliesTo(true, null)).toBe(true);
    expect(directorLiteAppliesTo(true, "broker")).toBe(false);
    expect(directorLiteAppliesTo(true, "supervisor")).toBe(false);
    expect(directorLiteAppliesTo(true, "manager")).toBe(false);
  });

  it("regra de página: respeita o opt-out para qualquer papel", async () => {
    setup({ key: true, mode: "NORMAL" });

    expect(isDirectorLiteRouteOptedOut("/agenda")).toBe(true);
    await expect(isDirectorLitePageOnServer(director, "/leads")).resolves.toBe(true);
    await expect(isDirectorLitePageOnServer(marketing, "/leads")).resolves.toBe(true);
    await expect(isDirectorLitePageOnServer(director, "/agenda")).resolves.toBe(false);
    await expect(isDirectorLitePageOnServer(marketing, "/agenda")).resolves.toBe(false);
  });

  it("fails closed when the setting or the experience mode cannot be read", async () => {
    getSystemSetting.mockRejectedValue(new Error("settings unavailable"));
    await expect(shouldUseDirectorLiteStyle(director)).resolves.toBe(false);

    getSystemSetting.mockResolvedValue("true");
    getExperienceMode.mockRejectedValue(new Error("db down"));
    await expect(shouldUseDirectorLiteStyle(director)).resolves.toBe(false);
  });
});

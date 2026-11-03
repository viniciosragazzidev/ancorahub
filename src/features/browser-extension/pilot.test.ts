import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ setting: vi.fn() }));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: state.setting }));

import { isExtensionPilotUser, EXTENSION_PILOT_USERS_SETTING } from "./pilot";

describe("allowlist global do piloto da extensão", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fecha por padrão quando a chave não existe ou está vazia", async () => {
    state.setting.mockResolvedValueOnce(undefined).mockResolvedValueOnce("  , \n ");
    expect(await isExtensionPilotUser("vinicios")).toBe(false);
    expect(await isExtensionPilotUser("vinicios")).toBe(false);
    expect(state.setting).toHaveBeenCalledWith(EXTENSION_PILOT_USERS_SETTING);
  });

  it("aceita somente IDs exatos separados por vírgula ou quebra de linha", async () => {
    state.setting.mockResolvedValue(" user-a,\nuser-b ");
    expect(await isExtensionPilotUser("user-a")).toBe(true);
    expect(await isExtensionPilotUser("user-b")).toBe(true);
    expect(await isExtensionPilotUser("user")).toBe(false);
  });
});

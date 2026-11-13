import { beforeEach, describe, expect, it, vi } from "vitest";
const setting = vi.hoisted(() => vi.fn());
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: setting }));
import { brokerHomePilotApplies, parseBrokerHomePilot } from "./home-pilot";
import { getBrokerHomePresentation } from "./home-pilot-settings";
import type { TenantContext } from "@/shared/auth/types";

const brokerId = "00000000-0000-4000-8000-000000000001";
const context: TenantContext = {
  tenantId: "tenant-a",
  userId: brokerId,
  role: "broker",
  jobTitle: "broker",
  branchId: null,
};
const pilot = { enabled: true, brokerIds: [brokerId], showLearning: true };
beforeEach(() => vi.clearAllMocks());
describe("piloto da Home do corretor", () => {
  it("não libera configuração ausente, inválida ou sem participantes", () => {
    for (const value of [undefined, "bad", "{}", '{"enabled":"true","brokerIds":[]}'])
      expect(parseBrokerHomePilot(value).enabled).toBe(false);
    expect(brokerHomePilotApplies({ ...pilot, brokerIds: [] }, context)).toBe(false);
  });
  it("limita ao corretor selecionado e permite reversão", () => {
    expect(brokerHomePilotApplies(pilot, context)).toBe(true);
    expect(brokerHomePilotApplies(pilot, { ...context, role: "supervisor" })).toBe(false);
    expect(brokerHomePilotApplies(pilot, { ...context, userId: "other" })).toBe(false);
    expect(brokerHomePilotApplies({ ...pilot, enabled: false }, context)).toBe(false);
  });
  it("lê exclusivamente a configuração da empresa autenticada", async () => {
    setting.mockImplementation(async (key: string) =>
      key.endsWith("tenant-a") ? JSON.stringify(pilot) : undefined,
    );
    expect((await getBrokerHomePresentation(context)).enabled).toBe(true);
    expect((await getBrokerHomePresentation({ ...context, tenantId: "tenant-b" })).enabled).toBe(
      false,
    );
    expect(setting).toHaveBeenCalledWith("feature_broker_home_v2_tenant-b");
  });
  it("falha fechado e não consulta configuração para outros papéis", async () => {
    expect((await getBrokerHomePresentation({ ...context, role: "director" })).enabled).toBe(false);
    expect(setting).not.toHaveBeenCalled();
    setting.mockRejectedValue(new Error("offline"));
    expect((await getBrokerHomePresentation(context)).enabled).toBe(false);
  });
});

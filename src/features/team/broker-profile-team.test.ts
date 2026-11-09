import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const getSupervisedBrokerIds = vi.fn(async () => ["broker-a", "broker-b"]);
vi.mock("@/features/team/supervisor-service", () => ({ getSupervisedBrokerIds: (...args: unknown[]) => getSupervisedBrokerIds(...(args as [])) }));

import { getBrokerProfileTeamIds } from "./broker-profile-team";

describe("getBrokerProfileTeamIds", () => {
  beforeEach(() => getSupervisedBrokerIds.mockClear());

  it("não se aplica a diretor, gestor nem corretor", async () => {
    for (const role of ["director", "manager", "broker"] as const) {
      await expect(getBrokerProfileTeamIds({ role, tenantId: "t", userId: "u" })).resolves.toBeNull();
    }
    expect(getSupervisedBrokerIds).not.toHaveBeenCalled();
  });

  it("supervisor com escopo de equipe recebe os corretores dele", async () => {
    await expect(getBrokerProfileTeamIds({ role: "supervisor", tenantId: "t", userId: "sup", supervisorTeamScope: true })).resolves.toEqual(["broker-a", "broker-b"]);
    expect(getSupervisedBrokerIds).toHaveBeenCalledWith("t", "sup");
  });

  it("supervisor sem escopo de equipe não abre perfil nenhum", async () => {
    await expect(getBrokerProfileTeamIds({ role: "supervisor", tenantId: "t", userId: "sup", supervisorTeamScope: false })).resolves.toEqual([]);
    expect(getSupervisedBrokerIds).not.toHaveBeenCalled();
  });

  it("falha na consulta vira lista vazia (sem link, nunca link quebrado)", async () => {
    getSupervisedBrokerIds.mockRejectedValueOnce(new Error("db"));
    await expect(getBrokerProfileTeamIds({ role: "supervisor", tenantId: "t", userId: "sup", supervisorTeamScope: true })).resolves.toEqual([]);
  });
});

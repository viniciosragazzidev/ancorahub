import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  pilot: vi.fn(), createCode: vi.fn(), insert: vi.fn(),
  context: { userId: "broker-a", tenantId: "tenant-a", role: "broker" as const },
}));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: vi.fn(async () => state.context) }));
vi.mock("@/shared/auth/authorization", () => ({ requireAnyRole: (context: typeof state.context) => context }));
vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => ({ insert: state.insert }) }));
vi.mock("./pilot", () => ({ isExtensionPilotUser: state.pilot }));
vi.mock("./auth", () => ({ createExtensionAuthorizationCode: state.createCode }));

import { AuthorizationError } from "@/shared/auth/errors";
import { createExtensionCodeAction } from "./actions";

describe("ação de código da extensão no piloto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.pilot.mockResolvedValue(true);
    state.createCode.mockResolvedValue("código-temporário");
    state.insert.mockReturnValue({ values: () => ({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }) });
  });

  it("recusa fora da allowlist antes de criar código ou configuração de tenant", async () => {
    state.pilot.mockResolvedValue(false);
    await expect(createExtensionCodeAction()).rejects.toBeInstanceOf(AuthorizationError);
    expect(state.insert).not.toHaveBeenCalled();
    expect(state.createCode).not.toHaveBeenCalled();
  });

  it("mantém o código manual de alternativa para usuário do piloto", async () => {
    await expect(createExtensionCodeAction()).resolves.toEqual({ code: "código-temporário", expiresInSeconds: 300 });
    expect(state.createCode).toHaveBeenCalledWith(undefined);
  });
});

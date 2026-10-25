import { beforeEach, describe, expect, it, vi } from "vitest";

const { context, redirect, getExperienceMode } = vi.hoisted(() => ({
  context: { role: "director", tenantId: "t1", userId: "u1" } as { role: string; tenantId: string; userId: string },
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  getExperienceMode: vi.fn(async () => "FULL"),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => context }));
vi.mock("@/features/broker-workspace/experience-mode", () => ({ getExperienceMode }));
vi.mock("@/shared/db", () => ({ getDatabase: () => ({}), schema: {} }));

import MinhaFilaPage from "./page";

describe("/minha-fila por papel", () => {
  beforeEach(() => {
    redirect.mockClear();
    getExperienceMode.mockClear();
  });

  it("diretor vai para /leads no servidor, antes de carregar a fila", async () => {
    context.role = "director";
    await expect(MinhaFilaPage()).rejects.toThrow("NEXT_REDIRECT:/leads");
    expect(redirect).toHaveBeenCalledWith("/leads");
    expect(getExperienceMode).not.toHaveBeenCalled();
  });

  it.each(["broker", "supervisor", "manager"])("%s não é redirecionado", async (role) => {
    context.role = role;
    getExperienceMode.mockResolvedValueOnce("FULL");
    await MinhaFilaPage();
    expect(redirect).not.toHaveBeenCalled();
    expect(getExperienceMode).toHaveBeenCalled();
  });
});

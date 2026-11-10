import { describe, expect, it, vi } from "vitest";

const { getRequiredTenantContext, redirect } = vi.hoisted(() => ({
  getRequiredTenantContext: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext }));
vi.mock("next/navigation", () => ({ redirect }));

import { redirectManagerAway } from "./deny-manager";

describe("layout das áreas fora da gestão da unidade (10/11)", () => {
  it.each([
    ["gestor da unidade", { role: "manager", jobTitle: "manager", branchId: "u1" }],
    ["gestor sem unidade", { role: "manager", jobTitle: "manager", branchId: null }],
    ["gestor sem função gravada", { role: "manager", jobTitle: null, branchId: "u1" }],
  ])("manda o %s para a equipe", async (_label, context) => {
    getRequiredTenantContext.mockResolvedValue(context);
    await expect(redirectManagerAway()).rejects.toThrow("redirect:/equipe");
  });

  it.each([
    ["diretor", { role: "director", jobTitle: "director" }],
    ["supervisor", { role: "supervisor", jobTitle: "supervisor" }],
    ["corretor", { role: "broker", jobTitle: "broker" }],
    ["marketing (papel manager)", { role: "manager", jobTitle: "marketing" }],
    ["financeiro (papel manager)", { role: "manager", jobTitle: "finance" }],
  ])("deixa o %s passar", async (_label, context) => {
    getRequiredTenantContext.mockResolvedValue(context);
    await expect(redirectManagerAway()).resolves.toMatchObject(context);
  });
});

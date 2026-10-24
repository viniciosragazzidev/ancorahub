import { describe, expect, it, vi } from "vitest";

const { getRequiredTenantContext, redirect } = vi.hoisted(() => ({
  getRequiredTenantContext: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));

vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext }));
vi.mock("next/navigation", () => ({ redirect }));

import AliasLayout from "./layout";

describe("layout do alias /distribuicao", () => {
  it("herda a negação para gestor da rota de distribuição", async () => {
    getRequiredTenantContext.mockResolvedValue({ role: "manager" });
    await expect(AliasLayout({ children: "conteúdo" })).rejects.toThrow("redirect:/access-denied");
  });

  it("preserva acesso para Diretor", async () => {
    getRequiredTenantContext.mockResolvedValue({ role: "director" });
    await expect(AliasLayout({ children: "conteúdo" })).resolves.toBe("conteúdo");
  });
});

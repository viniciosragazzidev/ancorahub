// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ enabled: true, detail: vi.fn(), redirect: vi.fn(() => { throw new Error("redirect"); }) }));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => ({ role: "broker", tenantId: "t-1", userId: "u-1", jobTitle: "broker", branchId: null }) }));
vi.mock("@/features/erp/broker-finance", () => ({ isBrokerLiteFinanceEnabled: async () => mocks.enabled, getBrokerFinanceDetail: mocks.detail }));

import MyFinancePage from "./page";

const renderPage = async (pagina?: string) => render(await MyFinancePage({ searchParams: Promise.resolve({ pagina }) }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled = true;
});

describe("/meu-financeiro", () => {
  it("com a chave desligada volta ao Início", async () => {
    mocks.enabled = false;
    await expect(renderPage()).rejects.toThrow("redirect");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
    expect(mocks.detail).not.toHaveBeenCalled();
  });

  it("sem acesso ao financeiro mostra o estado de liberação pela direção", async () => {
    mocks.detail.mockResolvedValue(null);
    await renderPage();
    expect(screen.getByText(/liberado pela direção/)).toBeTruthy();
  });

  it("falha na leitura mostra o estado de erro", async () => {
    mocks.detail.mockRejectedValue(new Error("banco fora"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await renderPage();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("passa a página da URL e ignora valor inválido", async () => {
    mocks.detail.mockResolvedValue(null);
    await renderPage("3");
    expect(mocks.detail).toHaveBeenLastCalledWith(expect.objectContaining({ userId: "u-1" }), { page: 3 });
    cleanup();
    await renderPage("abc");
    expect(mocks.detail).toHaveBeenLastCalledWith(expect.anything(), { page: 1 });
  });
});

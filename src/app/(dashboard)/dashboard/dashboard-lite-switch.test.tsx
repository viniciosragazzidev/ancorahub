// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({ role: "director" as string, flag: true }));

vi.mock("@/shared/auth/tenant-context", () => ({
  getRequiredTenantContext: async () => ({ role: access.role, tenantId: "tenant-a" }),
}));
vi.mock("@/features/director-lite/style-flag", () => ({
  shouldUseDirectorLiteStyle: async (context: { role: string }) => !["broker", "supervisor"].includes(context.role) && access.flag,
}));

import { ArcScopeProvider } from "@/components/arc/arc-scope-context";
import LegacyDashboardLoading from "./loading-legacy";
import Loading from "./loading";
import { DirectorLiteDashboardSkeleton } from "./loading-lite";
import DashboardError from "./error";

beforeEach(() => {
  access.role = "director";
  access.flag = true;
});
afterEach(cleanup);

describe("painel do diretor: troca pela chave", () => {
  it("loading: com a chave ligada, mostra o skeleton Lite", async () => {
    const element = await Loading();
    expect(element.type).toBe(DirectorLiteDashboardSkeleton);
  });

  it("loading: com a chave desligada, mostra exatamente o skeleton de hoje", async () => {
    access.flag = false;
    const element = await Loading();
    expect(element.type).toBe(LegacyDashboardLoading);
  });

  it("loading: para corretor ou supervisor, fica o skeleton de hoje mesmo com a chave ligada", async () => {
    access.role = "supervisor";
    const element = await Loading();
    expect(element.type).toBe(LegacyDashboardLoading);
  });

  it("erro: dentro do escopo Lite, mostra a mensagem Lite com 'Tentar de novo'", () => {
    const reset = vi.fn();
    render(
      <ArcScopeProvider enabled>
        <DashboardError error={new Error("boom")} reset={reset} />
      </ArcScopeProvider>,
    );
    expect(screen.getByText("Não deu para carregar o painel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("erro: fora do escopo Lite, mostra o erro de hoje", () => {
    render(<DashboardError error={new Error("boom")} reset={() => {}} />);
    expect(screen.getByText("Não foi possível carregar esta operação")).toBeInTheDocument();
    expect(screen.queryByText("Não deu para carregar o painel")).not.toBeInTheDocument();
  });
});

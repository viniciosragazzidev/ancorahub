// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/administracao/erp",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../governance-actions", () => ({ saveErpModuleAction: vi.fn(async () => ({ ok: true, message: "ok" })) }));
vi.mock("../platform-actions", () => ({ updateErpPlatformAction: vi.fn(async () => ({ ok: true, message: "ok" })) }));

import { ErpSkinProvider } from "../ui/skin-context";
import { ErpGovernanceWorkspace } from "./governance-forms";

afterEach(cleanup);

type Governance = Parameters<typeof ErpGovernanceWorkspace>[0]["workspace"];
const base = { ready: true, globallyAvailable: true, enabled: true, roles: ["director", "manager"], maxImportRows: 100, version: 3, params: { showNames: false, intervalSeconds: 20 } };
const workspace: Governance = {
  platform: { enabled: true, modules: ["imports", "tv", "analytics"] },
  modules: [
    { key: "imports", label: "Importações", description: "Prévia de arquivos.", dependencies: [], ...base },
    { key: "tv", label: "Modo TV", description: "Indicadores agregados.", dependencies: ["analytics"], ...base, enabled: false },
  ],
  events: [{ id: "ev-1", action: "erp.module.updated", entityId: "imports", createdAt: new Date("2026-11-10T12:00:00Z"), actor: "Ana Souza" }],
} as Governance;

describe.each(["standard", "lite"] as const)("Governança do ERP (%s)", (skin) => {
  it("lista módulos numa tabela e abre o drawer com o formulário e o histórico", () => {
    render(<ErpSkinProvider skin={skin}><ErpGovernanceWorkspace workspace={workspace} /></ErpSkinProvider>);
    expect(screen.getAllByText("Diretor, Gestor").length).toBeGreaterThan(0);
    expect(screen.queryAllByRole("button", { name: "Salvar configuração" })).toHaveLength(0);
    const cell = screen.getAllByText("Importações")[0];
    fireEvent.click(cell.closest("tr") ?? cell);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Salvar configuração" })).toHaveAttribute("type", "submit");
    expect(within(dialog).getByLabelText("Linhas por importação")).toHaveValue(100);
    expect(within(dialog).getByText("Ana Souza")).toBeInTheDocument();
  });

  it("módulo de TV mostra os parâmetros de exibição", () => {
    render(<ErpSkinProvider skin={skin}><ErpGovernanceWorkspace workspace={workspace} /></ErpSkinProvider>);
    const cell = screen.getAllByText("Modo TV")[0];
    fireEvent.click(cell.closest("tr") ?? cell);
    expect(within(screen.getByRole("dialog")).getByLabelText("Segundos por tela")).toHaveValue(20);
  });
});

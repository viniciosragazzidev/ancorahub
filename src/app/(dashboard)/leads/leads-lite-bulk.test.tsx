// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArcScopeProvider } from "@/components/arc/arc-scope-context";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";

import { LeadsListSwitch } from "./leads-lite-list";

vi.mock("./leads-data-table", () => ({ LeadsDataTable: () => <div data-testid="legacy-table" /> }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => "/leads", useRouter: () => ({ replace: vi.fn() }) }));
const actions = vi.hoisted(() => ({
  bulkChangeLeadStatusAction: vi.fn(async () => ({})),
  bulkReassignLeadsAction: vi.fn(async () => ({})),
  bulkReassignBranchAction: vi.fn(async () => ({})),
  bulkRevertToQualificationAction: vi.fn(async () => ({ success: true, mutationId: "m1", message: "2 leads devolvidos.", changedLeadIds: ["l1", "l2"] })),
}));
vi.mock("./status-actions", () => actions);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const base = {
  status: "new",
  qualificationStatus: "hot",
  origem: "Meta Ads",
  sourceCampaign: null,
  tipo: "PME",
  createdAt: "2026-10-24T14:02:00.000Z",
  assignedAt: null,
  stageEnteredAt: null,
  serviceStartedAt: null,
  firstContactAt: null,
  corretorId: null,
  corretorNome: null,
  branchId: "b1",
  branchName: "Centro",
} satisfies Partial<LeadWorkspaceItem>;

const leads: LeadWorkspaceItem[] = [
  { ...base, id: "l1", nome: "Maria Nova", telefone: "21 90000-0101" },
  { ...base, id: "l2", nome: "Carlos Mendes", telefone: "21 90000-0102" },
];

function renderList({ selectedIds = [] as string[], role = "director", onToggleRow = vi.fn(), onSelectAll = vi.fn(), onRevertCommitted = vi.fn() } = {}) {
  render(
    <ArcScopeProvider enabled>
      <LeadsListSwitch
        leads={leads}
        contextRole={role}
        selectedIds={selectedIds}
        isAllSelected={selectedIds.length === leads.length}
        onToggleRow={onToggleRow}
        onSelectAll={onSelectAll}
        onRowClick={() => {}}
        liteBulk={{ role, brokers: [{ id: "c1", name: "Ana Souza", branchId: "b1" }], branches: [{ id: "b1", name: "Centro" }], onRevertCommitted }}
      />
    </ArcScopeProvider>,
  );
  return { onToggleRow, onSelectAll, onRevertCommitted };
}

describe("seleção em massa na lista Lite", () => {
  it("caixas por linha e selecionar todos alimentam a seleção do workspace", () => {
    const { onToggleRow, onSelectAll } = renderList();
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Selecionar Carlos Mendes" })[0]!);
    expect(onToggleRow).toHaveBeenCalledWith("l2");
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos" }));
    expect(onSelectAll).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("region", { name: "Ações em lote" })).not.toBeInTheDocument();
  });

  it("diretor vê as mesmas ações de hoje; Limpar seleção limpa", () => {
    const { onSelectAll } = renderList({ selectedIds: ["l1", "l2"] });
    const bar = within(screen.getByRole("region", { name: "Ações em lote" }));
    expect(bar.getByText("2 selecionados")).toBeInTheDocument();
    expect(bar.getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? button.textContent)).toEqual([
      "Alterar status",
      "Trocar corretor",
      "Transferir unidade",
      "Devolver para qualificação",
      "Exportar CSV",
      "Limpar seleção",
    ]);
    fireEvent.click(bar.getByRole("button", { name: "Limpar seleção" }));
    expect(onSelectAll).toHaveBeenCalledWith(false);
  });

  it("corretor só tem a exportação, como na tabela atual", () => {
    renderList({ selectedIds: ["l1"], role: "broker" });
    const bar = within(screen.getByRole("region", { name: "Ações em lote" }));
    expect(bar.queryByRole("button", { name: "Alterar status" })).not.toBeInTheDocument();
    expect(bar.getByRole("button", { name: "Exportar CSV" })).toBeInTheDocument();
  });

  it("alterar status abre o diálogo atual de status em lote", () => {
    renderList({ selectedIds: ["l1"] });
    fireEvent.click(screen.getByRole("button", { name: "Alterar status" }));
    expect(screen.getByRole("dialog", { name: "Alterar status em lote" })).toBeInTheDocument();
  });

  it("trocar corretor e transferir unidade abrem a gestão em lote na aba certa", () => {
    renderList({ selectedIds: ["l1"] });
    fireEvent.click(screen.getByRole("button", { name: "Transferir unidade" }));
    const dialog = within(screen.getByRole("dialog", { name: "Gestão de leads em lote" }));
    expect(dialog.getByRole("button", { name: "Transferir unidade" })).toBeInTheDocument();
  });

  it("devolver para a qualificação pede confirmação antes de rodar a ação", async () => {
    const { onRevertCommitted } = renderList({ selectedIds: ["l1", "l2"] });
    fireEvent.click(screen.getByRole("button", { name: "Devolver para qualificação" }));
    const confirm = screen.getByRole("alertdialog", { name: "Devolver para qualificação?" });
    expect(confirm).toHaveTextContent("Os 2 leads selecionados voltam para a qualificação");
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    expect(actions.bulkRevertToQualificationAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Devolver para qualificação" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Devolver" }));
    });
    expect(actions.bulkRevertToQualificationAction).toHaveBeenCalledTimes(1);
    const formData = (actions.bulkRevertToQualificationAction.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(formData.getAll("leadIds")).toEqual(["l1", "l2"]);
    expect(toast.success).toHaveBeenCalledWith("2 leads devolvidos.");
    expect(onRevertCommitted).toHaveBeenCalledWith({ leadIds: ["l1", "l2"] });
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/implantacoes",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../implantation-actions", () => ({
  saveImplantationAction: vi.fn(async () => ({ ok: true, message: "ok" })),
  adoptImplantationEvidenceAction: vi.fn(async () => ({ ok: true, message: "ok" })),
}));

import { ErpSkinProvider } from "../ui/skin-context";
import { ImplantationsWorkspace } from "./implantations-workspace";

afterEach(cleanup);

type Workspace = Parameters<typeof ImplantationsWorkspace>[0]["workspace"];
const row: Workspace["rows"][number] = {
  leadId: "lead-1", name: "Negócio Alfa", branchId: "b1", brokerId: "u1", brokerName: "Ana Souza", implantationId: "imp-1", stage: "submitted",
  reference: "PROT-1", policyNumber: "", coverageStartsOn: null, evidenceId: null, reason: "", version: 2, updatedAt: new Date("2026-11-10T12:00:00Z"),
  history: [{ id: "ev-1", createdAt: new Date("2026-11-10T12:00:00Z"), actor: "Bruno Lima", status: "submitted", reviewedImport: true }],
  canOpenLead: true,
};
const workspace: Workspace = {
  filters: { q: "", status: "all", page: 1 }, total: 1, pageSize: 25,
  counts: { awaiting_documents: 0, review: 3, submitted: 1, operator_pending: 0, implanted: 4, refused: 0, cancelled: 0 },
  evidence: [], nativeDocuments: [{ id: "doc-1", leadId: "lead-1", fileName: "aprovado.pdf" }], canManage: true, canApproveDocument: true, rows: [row],
};

describe.each(["standard", "lite"] as const)("ImplantationsWorkspace (%s)", (skin) => {
  it("lista os negócios, abre o drawer com formulário, evidência e histórico", () => {
    render(<ErpSkinProvider skin={skin}><ImplantationsWorkspace workspace={workspace} /></ErpSkinProvider>);
    expect(screen.getAllByText("Ana Souza").length).toBeGreaterThan(0);
    expect(screen.getByText("Implantadas")).toBeInTheDocument();
    const cell = screen.getAllByText("Negócio Alfa")[0];
    fireEvent.click(cell.closest("tr") ?? cell);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Salvar conferência" })).toHaveAttribute("type", "submit");
    expect(within(dialog).getByRole("button", { name: "Usar" })).toHaveAttribute("type", "button");
    expect(within(dialog).getByText(/via importação/)).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Abrir negócio" })).toHaveAttribute("href", "/leads/lead-1");
    expect(dialog.querySelector("details")).toBeNull();
  });

  it("sem permissão de gestão mostra só o resumo, sem formulário", () => {
    render(<ErpSkinProvider skin={skin}><ImplantationsWorkspace workspace={{ ...workspace, canManage: false }} /></ErpSkinProvider>);
    const cell = screen.getAllByText("Negócio Alfa")[0];
    fireEvent.click(cell.closest("tr") ?? cell);
    expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "Salvar conferência" })).not.toBeInTheDocument();
  });
});

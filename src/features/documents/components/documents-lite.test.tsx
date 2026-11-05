// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CARRIER_FIXTURES, DOC_FIXTURES, PLAN_FIXTURES, REQUIREMENT_FIXTURES } from "./documents-fixtures";
import { DocumentsLite } from "./documents-lite";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const actions = vi.hoisted(() => ({
  createRequirementAction: vi.fn(async () => ({})),
  deleteRequirementAction: vi.fn(async () => ({ success: true })),
  reviewDocumentAction: vi.fn(async () => ({ success: true })),
  bulkReviewDocumentsAction: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/features/documents/actions", () => actions);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderDocs = () => render(<DocumentsLite carriers={CARRIER_FIXTURES} plans={PLAN_FIXTURES} initialRequirements={REQUIREMENT_FIXTURES} initialPendingDocs={DOC_FIXTURES} canConfigure />);
const table = () => document.querySelector('[data-lite="table"]') as HTMLElement;

describe("documentos Lite", () => {
  it("fila com contagens por status, 10 por página e filtro por status", () => {
    renderDocs();
    const chips = within(screen.getByRole("group", { name: "Status dos documentos" }));
    expect(chips.getByRole("button", { name: /Pendentes/ })).toHaveTextContent("9");
    expect(chips.getByRole("button", { name: /Pendentes/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(table()).getAllByRole("row")).toHaveLength(10);
    fireEvent.click(chips.getByRole("button", { name: /Rejeitados/ }));
    expect(within(table()).getAllByRole("row")).toHaveLength(3);
    expect(within(table()).getAllByText("Rejeitado").length).toBe(2);
  });

  it("aprova por linha e rejeita em lote pelas mesmas ações", async () => {
    renderDocs();
    await act(async () => {
      fireEvent.click(within(table()).getAllByRole("button", { name: /^Aprovar / })[0]!);
    });
    expect(actions.reviewDocumentAction).toHaveBeenCalledWith({ documentId: "doc-1", leadId: "lead-1", status: "approved" });
    expect(toast.success).toHaveBeenCalledWith("Documento aprovado.");
    fireEvent.click(within(table()).getByRole("checkbox", { name: "Selecionar todos" }));
    const bar = within(screen.getByRole("region", { name: "Ações em lote" }));
    await act(async () => {
      fireEvent.click(bar.getByRole("button", { name: "Rejeitar" }));
    });
    expect(actions.bulkReviewDocumentsAction).toHaveBeenCalledWith(expect.arrayContaining(["doc-2"]), "rejected");
  });

  it("resumo da fila mostra pendentes e a idade do pendente mais antigo", () => {
    render(<DocumentsLite carriers={CARRIER_FIXTURES} plans={PLAN_FIXTURES} initialRequirements={REQUIREMENT_FIXTURES} initialPendingDocs={DOC_FIXTURES} generatedAt={new Date(Date.UTC(2026, 9, 27, 8, 10))} />);
    const summary = within(screen.getByRole("group", { name: "Resumo da fila" }));
    expect(summary.getByText("Aguardando aprovação").nextSibling).toHaveTextContent("9");
    expect(summary.getByText("3 dias")).toBeInTheDocument();
  });

  it("vazio pela busca é diferente de tudo em dia", () => {
    renderDocs();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar documentos" }), { target: { value: "inexistente" } });
    expect(screen.getByText("Nenhum documento encontrado com esse filtro.")).toBeInTheDocument();
    expect(screen.queryByText("Tudo em dia")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(within(table()).getAllByRole("row")).toHaveLength(10);
  });

  it("linha fica desabilitada enquanto a revisão roda (sem envio duplo)", async () => {
    let resolve: (value: { success: boolean }) => void = () => {};
    actions.reviewDocumentAction.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    renderDocs();
    const approve = within(table()).getAllByRole("button", { name: /^Aprovar / })[0]!;
    await act(async () => {
      fireEvent.click(approve);
      fireEvent.click(approve);
    });
    expect(actions.reviewDocumentAction).toHaveBeenCalledTimes(1);
    expect(approve).toBeDisabled();
    await act(async () => resolve({ success: true }));
  });

  it("requisitos: excluir pede confirmação Lite e roda a mesma ação", async () => {
    renderDocs();
    fireEvent.click(screen.getByRole("tab", { name: "Configuração de requisitos" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Excluir requisito Cartão CNPJ" })[0]!);
    const dialog = screen.getByRole("alertdialog", { name: "Excluir este requisito?" });
    expect(actions.deleteRequirementAction).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Excluir requisito" }));
    });
    expect(actions.deleteRequirementAction).toHaveBeenCalledWith("req-3");
    expect(toast.success).toHaveBeenCalledWith("Requisito removido.");
    expect(screen.getByRole("textbox", { name: "Nome do documento" })).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BulkReassignDialog } from "./bulk-reassign-dialog";
import { BulkStatusDialog } from "./bulk-status-dialog";

vi.mock("@/app/(dashboard)/leads/status-actions", () => ({
  bulkReassignLeadsAction: vi.fn(),
  bulkReassignBranchAction: vi.fn(),
  bulkRevertToQualificationAction: vi.fn(),
}));

afterEach(cleanup);

// Sem as props novas (abertura controlada da barra Lite), os diálogos de lote seguem com o mesmo HTML de antes.
// O snapshot foi gerado com os arquivos originais.
describe("diálogos de lote sem a barra Lite", () => {
  it("status em lote: botão e diálogo aberto iguais aos de antes", async () => {
    render(<BulkStatusDialog leadIds={["a", "b"]} role="director" bulkStatusAction={vi.fn(async () => ({}))} />);
    expect(document.body.innerHTML).toMatchSnapshot("fechado");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Alterar status" }));
    });
    expect(document.body.innerHTML).toMatchSnapshot("aberto");
  });

  it("gestão em lote: botão e diálogo aberto iguais aos de antes", async () => {
    render(<BulkReassignDialog leadIds={["a"]} brokers={[{ id: "c1", name: "Ana", branchId: null }]} branches={[{ id: "b1", name: "Centro" }]} role="director" />);
    expect(document.body.innerHTML).toMatchSnapshot("fechado");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Gestão em lote/ }));
    });
    expect(document.body.innerHTML).toMatchSnapshot("aberto");
  });
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("@/features/marketing-import/actions", () => ({ uploadMetaLeadsAction: mocks.upload }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

import { MarketingImportClient } from "./marketing-import-client";
import { MarketingImportLite } from "./marketing-import-lite";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const BRANCHES = [{ id: "b1", name: "Barra da Tijuca" }, { id: "b2", name: "Niterói 1" }];
const HISTORY = [
  { id: "i1", fileName: "leads-meta-outubro-semana-4-barra-e-niteroi.xlsx", status: "completed", totalRows: 420, importedCount: 398, duplicateCount: 17, invalidCount: 5, durationMs: 8400, errorMessage: null, createdAt: new Date("2026-10-24T21:15:00.000Z"), userName: "Marina Exemplo" },
  { id: "i2", fileName: "pme-setembro.csv", status: "failed", totalRows: 0, importedCount: 0, duplicateCount: 0, invalidCount: 0, durationMs: null, errorMessage: "Formato inválido", createdAt: new Date("2026-10-20T12:00:00.000Z"), userName: null },
];

describe("importações com a chave desligada", () => {
  it("preserva o HTML legado", () => {
    const { container } = render(<MarketingImportClient branches={BRANCHES} history={HISTORY} lastImport={HISTORY[0]!} role="director" jobTitle="director" branchId={null} isCentralMarketing={false} />);
    // Datas da tela atual saem no fuso da máquina: normalizadas para o snapshot não depender do fuso.
    expect(container.innerHTML.replace(/\d{2}\/\d{2}\/\d{4},? \d{2}:\d{2}/g, "<data>")).toMatchSnapshot();
  });
});

describe("importações no visual Lite", () => {
  it("mostra a última importação no fuso de São Paulo e envia arquivo e unidade pela mesma action", async () => {
    mocks.upload.mockResolvedValue({ success: true, importId: "x", imported: 10, duplicates: 1, invalid: 0, durationMs: 1200, errors: [] });
    render(<MarketingImportLite branches={BRANCHES} history={HISTORY} lastImport={HISTORY[0]!} canChooseBranch={false} userBranchId="b1" />);
    expect(screen.getAllByText("24/10/2026, 18:15").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Nova importação" }));
    expect(screen.getByText("Os leads serão importados para sua unidade.")).toBeInTheDocument();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["a,b"], "leads.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Importar leads" })); });
    const form = mocks.upload.mock.calls[0]?.[0] as FormData;
    expect((form.get("file") as File).name).toBe("leads.csv");
    expect(form.get("branchId")).toBe("b1");
    expect(screen.getByText("Importação concluída")).toBeInTheDocument();
  });
});

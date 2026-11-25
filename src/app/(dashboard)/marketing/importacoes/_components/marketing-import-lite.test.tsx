// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), results: vi.fn() }));
vi.mock("@/features/marketing-import/actions", () => ({ uploadMetaLeadsAction: mocks.upload, getImportResultsAction: mocks.results }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));
const fire = vi.hoisted(() => vi.fn(() => ({ motion: false, celebrate: false })));
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => fire }));

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
    expect(fire).toHaveBeenCalledWith("confirm");
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("histórico em tabela: a linha abre o resultado com Só problemas ligado e o lead criado vira link", async () => {
    mocks.results.mockResolvedValue({ ok: true, detail: {
      import: { ...HISTORY[0]!, errorMessage: null },
      rows: [
        { rowIndex: 2, status: "created", message: null, nome: "Ana Criada", telefone: "5521999990000", leadId: "lead-1" },
        { rowIndex: 3, status: "invalid", message: "Telefone inválido", nome: "Bruno Problema", telefone: "55123", leadId: null },
      ],
    } });
    render(<MarketingImportLite branches={BRANCHES} history={HISTORY} lastImport={HISTORY[0]!} canChooseBranch={false} userBranchId="b1" />);
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Quando", "Arquivo", "Total", "Entraram", "Duplicados", "Com problema"]);
    const row = screen.getAllByText("leads-meta-outubro-semana-4-barra-e-niteroi.xlsx").map((cell) => cell.closest("tr")).find(Boolean)!;
    await act(async () => { fireEvent.click(row); });
    expect(mocks.results).toHaveBeenCalledWith("i1");
    expect(screen.getByRole("button", { name: /Só problemas/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("Bruno Problema").length).toBeGreaterThan(0);
    expect(screen.queryByText("Ana Criada")).toBeNull();
    expect(screen.getByRole("button", { name: /Baixar problemas \(CSV\)/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Só problemas/ }));
    expect(screen.getAllByRole("link", { name: "Ana Criada" })[0]).toHaveAttribute("href", "/leads/lead-1");
  });

  it("falha ao abrir o resultado mostra a causa e Tentar de novo", async () => {
    mocks.results.mockResolvedValueOnce({ ok: false, error: "Importação não encontrada." });
    render(<MarketingImportLite branches={BRANCHES} history={HISTORY} lastImport={HISTORY[0]!} canChooseBranch={false} userBranchId="b1" />);
    const row = screen.getAllByText("pme-setembro.csv").map((cell) => cell.closest("tr")).find(Boolean)!;
    await act(async () => { fireEvent.click(row); });
    expect(screen.getByRole("alert")).toHaveTextContent("Importação não encontrada.");
    mocks.results.mockResolvedValueOnce({ ok: true, detail: { import: HISTORY[1]!, rows: [] } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" })); });
    expect(mocks.results).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/A importação falhou: Formato inválido/)).toBeInTheDocument();
  });

  it("painel de envio oferece a planilha modelo PF e PME", () => {
    render(<MarketingImportLite branches={BRANCHES} history={HISTORY} lastImport={HISTORY[0]!} canChooseBranch={false} userBranchId="b1" />);
    fireEvent.click(screen.getByRole("button", { name: "Nova importação" }));
    expect(screen.getByRole("button", { name: /Baixar planilha modelo PF/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Baixar planilha modelo PME/ })).toBeEnabled();
  });

  it("falha na importação fica no painel com a causa e o botão vira Tentar de novo", async () => {
    mocks.upload.mockResolvedValueOnce({ success: false, error: "A planilha não tem a coluna Telefone." });
    render(<MarketingImportLite branches={BRANCHES} history={HISTORY} lastImport={HISTORY[0]!} canChooseBranch={false} userBranchId="b1" />);
    fireEvent.click(screen.getByRole("button", { name: "Nova importação" }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["a,b"], "leads.csv", { type: "text/csv" })] } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Importar leads" })); });
    expect(screen.getByRole("alert")).toHaveTextContent("A planilha não tem a coluna Telefone. Nenhum lead foi criado. O arquivo continua selecionado.");
    expect(fire).toHaveBeenCalledWith("error");
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeEnabled();
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/administracao/importacoes",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../import-actions", () => ({ reviewErpImportAction: vi.fn(async () => ({ ok: true, message: "ok" })) }));

import { ErpSkinProvider } from "../ui/skin-context";
import { ImportReview, ImportsWorkspace } from "./import-workspace";

afterEach(cleanup);

type Data = Parameters<typeof ImportsWorkspace>[0]["data"];
type Batch = Parameters<typeof ImportReview>[0]["batch"];
const data: Data = {
  maxRows: 100, domains: ["implantations", "finance"],
  rows: [{ id: "batch-1", fileName: "lote-novembro.csv", domain: "implantations", status: "preview", rowCount: 12, createdAt: new Date("2026-11-10T12:00:00Z"), createdBy: "Ana Souza" }],
};
const batch: Batch = {
  id: "batch-1", fileName: "lote-novembro.csv", status: "preview", createdAt: new Date("2026-11-10T12:00:00Z"), version: 2, createdBy: "u1", createdByName: "Ana Souza",
  reviewReason: null, reviewedAt: null, canApprove: true, domain: "implantations", financeRows: [],
  leadNames: { "lead-1": "Negócio Alfa" },
  rows: [{ leadId: "lead-1", expectedVersion: 1, status: "submitted", reference: "PROT", policyNumber: "", coverageStartsOn: null, evidenceDocumentId: null, reason: "x" }],
};

describe.each(["standard", "lite"] as const)("Importações (%s)", (skin) => {
  it("lista os lotes, abre o resumo e tem um único CTA primário de nova importação", () => {
    render(<ErpSkinProvider skin={skin}><ImportsWorkspace data={data} /></ErpSkinProvider>);
    const cta = screen.getByRole("button", { name: "Nova importação" });
    expect(cta).toHaveAttribute("type", "button");
    const cell = screen.getAllByText("lote-novembro.csv")[0];
    fireEvent.click(cell.closest("tr") ?? cell);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("link", { name: "Conferir lote" })).toHaveAttribute("href", "/administracao/importacoes/batch-1");
  });

  it("abre o painel de nova importação com envio e modelo", () => {
    render(<ErpSkinProvider skin={skin}><ImportsWorkspace data={data} /></ErpSkinProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Nova importação" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Preparar prévia" })).toHaveAttribute("type", "submit");
    expect(within(dialog).getByRole("link", { name: "Baixar modelo" })).toBeInTheDocument();
  });

  it("revisão mostra as linhas com o nome do negócio e os botões com tipo explícito", () => {
    render(<ErpSkinProvider skin={skin}><ImportReview batch={batch} /></ErpSkinProvider>);
    expect(screen.getAllByText("Negócio Alfa").length).toBeGreaterThan(0);
    for (const name of ["Aplicar lote conferido", "Revalidar prévia", "Rejeitar lote"]) expect(screen.getByRole("button", { name })).toHaveAttribute("type", "submit");
  });
});

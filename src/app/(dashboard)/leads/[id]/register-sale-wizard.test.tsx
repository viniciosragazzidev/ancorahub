// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RegisterSaleWizard } from "./register-sale-wizard";

vi.mock("next/navigation", () => {
  const router = { refresh: vi.fn() };
  return { useRouter: () => router };
});
vi.mock("@/components/motion/success-overlay", () => ({ useSuccessOverlay: () => ({ celebrate: vi.fn(), node: null }) }));
vi.mock("@/components/arc/file-dropzone/file-dropzone", () => ({ FileDropzone: () => <div>Escolher arquivo de teste</div> }));
vi.mock("@/components/arc/date-picker/date-picker", () => ({ DatePicker: ({ label }: { label: string }) => <button type="button" aria-label={label}>{label}</button> }));
vi.mock("@/app/(dashboard)/leads/[id]/beneficiaries-section", () => ({ BeneficiariesSection: () => <div>Pessoas cadastradas</div> }));
vi.mock("@/features/post-sale/actions", () => ({ ensureLeadHolderAction: vi.fn().mockResolvedValue({ success: true, created: false }), registerSaleAction: vi.fn() }));
vi.mock("@/features/documents/actions", () => ({ confirmDocumentUploadAction: vi.fn() }));
vi.mock("@/app/(dashboard)/leads/status-actions", () => ({ changeLeadStatusAction: vi.fn() }));

const lead = {
  id: "lead-preview", nome: "Mariana Costa", telefone: "5521999990000", email: "mariana@example.test",
  status: "converted", isCurrentBroker: true, createdAt: "2026-11-12T12:00:00.000Z",
  planName: "Essencial Empresarial", livesCount: 2, monthlyValue: "489.90", aiSalePrompt: "register" as const,
  beneficiaries: [{ id: "holder-1", name: "Mariana Costa", birthDate: "1988-03-14", age: 38, cpf: null, hasCpf: false, relationship: "titular", isHolder: true }],
};

afterEach(cleanup);

describe("RegisterSaleWizard", () => {
  it("shows an AI-converted lead in the same four-step flow", () => {
    render(<RegisterSaleWizard lead={lead} documents={[]} requirements={[]} carriers={[]} open onOpenChange={() => undefined} previewMode />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/Venda detectada pela IA/)).toBeTruthy();
    expect(screen.getByText("Passo 1 de 4 · Pessoas")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Falta cadastrar 1 pessoa");
  });

  it("uses the Arc date picker in Portuguese instead of native date inputs", () => {
    render(<RegisterSaleWizard lead={lead} documents={[]} requirements={[]} carriers={[]} open onOpenChange={() => undefined} previewMode />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Passo 2 de 4 · Plano")).toBeTruthy();
    expect(screen.queryByText(/Venda detectada pela IA/)).toBeNull();
    expect(screen.getByRole("button", { name: "Início da vigência" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Vencimento" })).toBeTruthy();
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });

  it("shows missing documents with an upload action and keeps confirmation approval required", () => {
    render(<RegisterSaleWizard
      lead={lead}
      documents={[{ id: "doc-confirmation", filename: "confirmacao.pdf", status: "pending", category: "contratacao" }]}
      requirements={[{ id: "identity", name: "Documento com foto", description: null, required: true, appliesPerBeneficiary: true }]}
      carriers={[]}
      open
      onOpenChange={() => undefined}
      previewMode
    />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Passo 3 de 4 · Documentos")).toBeTruthy();
    expect(screen.getByText("Aguardando aprovação")).toBeTruthy();
    expect(screen.getByText("Falta enviar")).toBeTruthy();
    expect(screen.getByText(/1 requisito ainda precisa ser aprovado/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Enviar$/ })).toBeTruthy();
    expect(screen.getByText("Enviar documento agora")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Enviar para aprovação/ })).toBeDisabled();
  });

  it("uses correct plural agreement when multiple documents are missing", () => {
    render(<RegisterSaleWizard
      lead={lead}
      documents={[]}
      requirements={[
        { id: "identity", name: "Documento com foto", description: null, required: true, appliesPerBeneficiary: false },
        { id: "address", name: "Comprovante de endereço", description: null, required: true, appliesPerBeneficiary: false },
      ]}
      carriers={[]}
      open
      onOpenChange={() => undefined}
      previewMode
    />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText(/2 requisitos ainda precisam ser aprovados/)).toBeTruthy();
  });
});

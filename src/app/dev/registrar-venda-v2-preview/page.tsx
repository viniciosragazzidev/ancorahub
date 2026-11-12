import { notFound } from "next/navigation";
import { RegisterSaleV2PreviewClient } from "@/app/dev/registrar-venda-v2-preview/preview-client";
import type { LightLeadDetailData, LiteRequirement } from "@/features/broker-workspace/components/light-lead-detail/types";
import type { ConfirmationDocument } from "@/features/broker-workspace/components/light-lead-detail/types";

type Scenario = "empty" | "error" | "pending" | "ai-converted";

export default async function SaleRegistrationPreviewPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { scenario: rawScenario } = await searchParams;
  const scenario: Scenario = rawScenario === "error" || rawScenario === "pending" || rawScenario === "ai-converted" ? rawScenario : "empty";
  const beneficiaries = scenario === "empty" ? [] : [
    { id: "holder-demo", name: "Mariana Costa", birthDate: "1988-03-14", age: 38, cpf: null, hasCpf: false, relationship: "titular", isHolder: true },
    { id: "dependent-demo", name: "Rafael Costa", birthDate: "2014-08-22", age: 12, cpf: null, hasCpf: false, relationship: "filho", isHolder: false },
  ];
  const lead: LightLeadDetailData = {
    id: "preview-lead-only",
    nome: scenario === "empty" ? "Mariana Costa" : "Mariana Costa",
    telefone: "+55 21 99999-0000",
    email: "mariana@example.test",
    status: scenario === "ai-converted" ? "converted" : "documentation_pending",
    isCurrentBroker: true,
    createdAt: "2026-11-12T12:00:00.000Z",
    planName: "Essencial Empresarial",
    livesCount: 3,
    monthlyValue: "489.90",
    beneficiaries,
    aiSalePrompt: scenario === "ai-converted" ? "register" : null,
  };
  const requirements: LiteRequirement[] = [
    { id: "identity-demo", name: "Documento de identidade", description: "Documento com foto", required: true, appliesPerBeneficiary: true },
    { id: "proof-demo", name: "Comprovante de endereço", description: null, required: true, appliesPerBeneficiary: false },
  ];
  const documents: ConfirmationDocument[] = scenario === "pending" ? [
    { id: "confirmation-pending", filename: "confirmacao-operadora.pdf", status: "pending", category: "contratacao", requirementId: null, requirementName: null, beneficiaryId: null },
    { id: "identity-approved", filename: "identidade-mariana.pdf", status: "approved", category: "identification", requirementId: "identity-demo", requirementName: "Documento de identidade", beneficiaryId: "holder-demo" },
  ] : scenario === "ai-converted" ? [
    { id: "confirmation-approved", filename: "confirmacao-operadora.pdf", status: "approved", category: "contratacao", requirementId: null, requirementName: null, beneficiaryId: null },
    { id: "identity-approved", filename: "identidade-mariana.pdf", status: "approved", category: "identification", requirementId: "identity-demo", requirementName: "Documento de identidade", beneficiaryId: "holder-demo" },
    { id: "address-approved", filename: "comprovante-endereco.pdf", status: "approved", category: "other", requirementId: "proof-demo", requirementName: "Comprovante de endereço", beneficiaryId: null },
  ] : [];
  const previewMessage = scenario === "error" ? "Não foi possível preparar o titular. Revise os dados do lead e tente novamente." : null;

  return (
    <main className="min-h-dvh bg-background px-2 py-3 sm:px-6 sm:py-6">
      <div className="mx-auto mb-3 flex max-w-3xl flex-wrap gap-2 text-xs">
        {(["empty", "error", "pending", "ai-converted"] as const).map((key) => <a key={key} className="rounded-full border border-border px-3 py-2" href={`/dev/registrar-venda-v2-preview?scenario=${key}`}>{key}</a>)}
      </div>
      <RegisterSaleV2PreviewClient
        lead={lead}
        documents={documents}
        requirements={requirements}
        carriers={[{ id: "carrier-demo", name: "Operadora Exemplo" }]}
        previewMessage={previewMessage}
      />
    </main>
  );
}

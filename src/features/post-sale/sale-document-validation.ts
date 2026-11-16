import { and, asc, eq, isNull, or } from "drizzle-orm";

import type { DatabaseExecutor } from "@/shared/db";
import { schema } from "@/shared/db";

export type SaleEvidence = {
  confirmationDocumentId: string;
  beneficiaries: Array<{ id: string; isHolder: boolean }>;
  requirements: Array<{ id: string; required: boolean; appliesPerBeneficiary: boolean }>;
  documents: Array<{ id: string; requirementId: string | null; beneficiaryId: string | null; status: string }>;
};

/** Locks every row that determines whether a sale has its required evidence. */
export async function lockSaleEvidence(
  tx: DatabaseExecutor,
  input: { tenantId: string; leadId: string; planId: string | null; confirmationDocumentId: string },
): Promise<SaleEvidence> {
  // Fixed table/row order: lead is locked by registerSale before this helper,
  // followed by beneficiaries, requirement definitions, then documents by id.
  const beneficiaries = await tx.select({ id: schema.leadBeneficiaries.id, isHolder: schema.leadBeneficiaries.isHolder })
    .from(schema.leadBeneficiaries)
    .where(and(eq(schema.leadBeneficiaries.tenantId, input.tenantId), eq(schema.leadBeneficiaries.leadId, input.leadId)))
    .orderBy(asc(schema.leadBeneficiaries.id))
    .for("update");

  const requirements = await tx.select({ id: schema.documentRequirements.id, required: schema.documentRequirements.required, appliesPerBeneficiary: schema.documentRequirements.appliesPerBeneficiary })
    .from(schema.documentRequirements)
    .where(and(
      eq(schema.documentRequirements.tenantId, input.tenantId),
      or(isNull(schema.documentRequirements.planId), eq(schema.documentRequirements.planId, input.planId ?? "")),
    ))
    .orderBy(asc(schema.documentRequirements.id))
    .for("update");

  const documents = await tx.select({
    id: schema.leadDocuments.id,
    requirementId: schema.leadDocuments.requirementId,
    beneficiaryId: schema.leadDocuments.beneficiaryId,
    status: schema.leadDocuments.status,
  }).from(schema.leadDocuments)
    .where(and(
      eq(schema.leadDocuments.tenantId, input.tenantId),
      eq(schema.leadDocuments.leadId, input.leadId),
      isNull(schema.leadDocuments.deletedAt),
    ))
    .orderBy(asc(schema.leadDocuments.id))
    .for("update");

  return { confirmationDocumentId: input.confirmationDocumentId, beneficiaries, requirements, documents };
}

export function saleEvidenceIssue(evidence: SaleEvidence): "confirmation" | "holder" | "required_documents" | null {
  const confirmation = evidence.documents.find((document) => document.id === evidence.confirmationDocumentId);
  if (!confirmation || confirmation.status !== "approved") return "confirmation";
  if (!evidence.beneficiaries.some((beneficiary) => beneficiary.isHolder)) return "holder";

  const missingRequiredDocument = evidence.requirements.some((requirement) => requirement.required && (
    requirement.appliesPerBeneficiary
      ? evidence.beneficiaries.some((beneficiary) => !evidence.documents.some((document) => document.requirementId === requirement.id && document.beneficiaryId === beneficiary.id && document.status === "approved"))
      : !evidence.documents.some((document) => document.requirementId === requirement.id && document.status === "approved")
  ));
  return missingRequiredDocument ? "required_documents" : null;
}

export function saleEvidenceIssueMessage(issue: ReturnType<typeof saleEvidenceIssue>): string | null {
  if (issue === "confirmation") return "A confirmação da operadora precisa estar anexada e aprovada.";
  if (issue === "holder") return "Cadastre o titular e os beneficiários antes de registrar a venda.";
  if (issue === "required_documents") return "Ainda existem documentos obrigatórios pendentes ou rejeitados.";
  return null;
}

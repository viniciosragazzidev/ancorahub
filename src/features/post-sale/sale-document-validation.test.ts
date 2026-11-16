import { describe, expect, it } from "vitest";

import { saleEvidenceIssue } from "./sale-document-validation";

const validEvidence = {
  confirmationDocumentId: "confirmation",
  beneficiaries: [{ id: "holder", isHolder: true }],
  requirements: [{ id: "identity", required: true, appliesPerBeneficiary: true }],
  documents: [
    { id: "confirmation", requirementId: null, beneficiaryId: null, status: "approved" },
    { id: "identity-file", requirementId: "identity", beneficiaryId: "holder", status: "approved" },
  ],
};

describe("saleEvidenceIssue", () => {
  it("permite somente evidência aprovada, ativa e completa para cada beneficiário", () => {
    expect(saleEvidenceIssue(validEvidence)).toBeNull();
    expect(saleEvidenceIssue({ ...validEvidence, documents: validEvidence.documents.filter((document) => document.id !== "confirmation") })).toBe("confirmation");
    expect(saleEvidenceIssue({ ...validEvidence, documents: validEvidence.documents.map((document) => document.id === "identity-file" ? { ...document, status: "rejected" } : document) })).toBe("required_documents");
    expect(saleEvidenceIssue({ ...validEvidence, beneficiaries: [{ id: "holder", isHolder: false }] })).toBe("holder");
  });
});

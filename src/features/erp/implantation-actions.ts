"use server";
import { revalidatePath } from "next/cache";
import { erpAction } from "./action-result";
import { saveImplantation } from "./implantations";
import { adoptNativeEvidence } from "./documents";
import { recordIdSchema, type ErpActionResult } from "./contracts";

export async function saveImplantationAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => {
    const leadId = recordIdSchema.parse(form.get("leadId"));
    const id = await saveImplantation({ leadId, expectedVersion: Number(form.get("version")), status: form.get("status"),
      reference: form.get("reference") ?? "", policyNumber: form.get("policyNumber") ?? "", coverageStartsOn: form.get("coverageStartsOn") || null,
      evidenceDocumentId: form.get("evidenceDocumentId") || null, reason: form.get("reason") ?? "" });
    revalidatePath("/implantacoes"); revalidatePath(`/leads/${leadId}`);
    return { id, message: "Implantação atualizada e registrada no histórico." };
  });
}

export async function adoptImplantationEvidenceAction(form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => {
    const id = await adoptNativeEvidence(recordIdSchema.parse(form.get("leadId")), recordIdSchema.parse(form.get("documentId")));
    revalidatePath("/implantacoes");
    return { id, message: "Documento aprovado vinculado à implantação." };
  });
}

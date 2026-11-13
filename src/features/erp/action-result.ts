import "server-only";
import { z } from "zod";
import { ErpError, type ErpActionResult } from "./contracts";

const FIELD_LABELS: Record<string, string> = {
  reason: "o motivo ou parecer (mínimo de 5 caracteres)", evidenceDocumentId: "o comprovante ou evidência", occurredOn: "a data do fato", dueOn: "o vencimento",
  competence: "a competência", amountCents: "o valor", reference: "a referência", description: "a descrição", beneficiaryId: "o beneficiário", saleId: "a venda",
  branchId: "a unidade", entryIds: "as comissões do repasse", leadId: "o negócio", status: "a etapa", coverageStartsOn: "o início de cobertura", decision: "a decisão",
};
/** Zod defaults are English; ERP screens always answer in Portuguese. */
export function erpValidationMessage(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return "Confira os campos informados.";
  if (!/^(Invalid|Too small|Too big|Expected|Unrecognized|Required)/i.test(issue.message)) return issue.message;
  const field = issue.path.map(String).find((part) => FIELD_LABELS[part]);
  return field ? `Confira ${FIELD_LABELS[field]}.` : "Confira os campos informados.";
}

export async function erpAction(work: () => Promise<{ message: string; id?: string }>): Promise<ErpActionResult> {
  try { return { ok: true, ...await work() }; }
  catch (error) {
    if (error instanceof ErpError) return { ok: false, message: error.message };
    if (error instanceof z.ZodError) return { ok: false, message: erpValidationMessage(error) };
    console.error("erp.action_failed", { correlationId: crypto.randomUUID(), errorType: error instanceof Error ? error.name : "unknown" });
    return { ok: false, message: "Não foi possível concluir. Atualize a página e tente novamente; se persistir, procure o administrador." };
  }
}

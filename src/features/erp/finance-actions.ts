"use server";
import { revalidatePath } from "next/cache";
import { erpAction } from "./action-result";
import { parseMoneyCents, type ErpActionResult } from "./contracts";
import { prepareFinancialEntry, prepareSettlement, prepareSettlementReversal, reviewFinancialEntry, reviewSettlement } from "./finance";
import { prepareOffset, prepareOffsetReversal, reviewOffset } from "./offsets";
import { prepareClosing, reviewClosing } from "./closing";

function refresh(id?: string) { revalidatePath("/financeiro", "layout"); if (id) revalidatePath(`/financeiro/lancamentos/${id}`); }
export async function prepareFinancialEntryAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => { const id = await prepareFinancialEntry({ requestId: form.get("requestId"), reference: form.get("reference"), kind: form.get("kind"), saleId: form.get("saleId") || null, branchId: form.get("branchId") || null, beneficiaryId: form.get("beneficiaryId") || null, amountCents: parseMoneyCents(String(form.get("amount") ?? "")), dueOn: form.get("dueOn"), competence: form.get("competence"), description: form.get("description"), evidenceDocumentId: null }); refresh(id); return { id, message: "Lançamento preparado. Envie a evidência e solicite aprovação independente." }; });
}
export async function reviewFinancialEntryAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => { const id = await reviewFinancialEntry({ id: form.get("id"), expectedVersion: Number(form.get("version")), decision: form.get("decision"), reason: form.get("reason") }); refresh(id); return { id, message: "Revisão registrada." }; });
}
export async function prepareSettlementAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => { const id = await prepareSettlement({ requestId: form.get("requestId"), entryId: form.get("entryId"), amountCents: parseMoneyCents(String(form.get("amount") ?? "")), occurredOn: form.get("occurredOn"), evidenceDocumentId: form.get("evidenceDocumentId"), reason: form.get("reason") }); refresh(String(form.get("entryId"))); return { id, message: "Liquidação preparada. Outra pessoa autorizada deve conferir e confirmar." }; });
}
export async function reviewSettlementAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => { const id = await reviewSettlement({ id: form.get("id"), decision: form.get("decision"), reason: form.get("reason") }); refresh(id); return { id, message: "Revisão da liquidação registrada." }; });
}
export async function reverseSettlementAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => { const id = await prepareSettlementReversal({ requestId: form.get("requestId"), settlementId: form.get("settlementId"), occurredOn: form.get("occurredOn"), evidenceDocumentId: form.get("evidenceDocumentId"), reason: form.get("reason") }); refresh(String(form.get("entryId"))); return { id, message: "Estorno preparado para conferência independente." }; });
}
export async function prepareOffsetAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => { const id = await prepareOffset({ requestId: form.get("requestId"), advanceEntryId: form.get("advanceEntryId"), commissionEntryId: form.get("commissionEntryId"), amountCents: parseMoneyCents(String(form.get("amount") ?? "")), occurredOn: form.get("occurredOn"), reason: form.get("reason") }); refresh(); return { id, message: "Compensação preparada para revisão independente." }; });
}
export async function reviewOffsetAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => { const id = await reviewOffset({ id: form.get("id"), decision: form.get("decision"), reason: form.get("reason") }); refresh(); return { id, message: "Revisão da compensação registrada." }; });
}
export async function reverseOffsetAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => { const id = await prepareOffsetReversal({ id: form.get("id"), requestId: form.get("requestId"), occurredOn: form.get("occurredOn"), reason: form.get("reason") }); refresh(); return { id, message: "Estorno da compensação preparado para revisão independente." }; });
}
export async function prepareClosingAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => { const id = await prepareClosing({ competence: form.get("competence"), expectedVersion: Number(form.get("version")), reason: form.get("reason") }); refresh(); return { id, message: "Prévia de fechamento preparada para revisão independente." }; });
}
export async function reviewClosingAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => { const id = await reviewClosing({ competence: form.get("competence"), expectedVersion: Number(form.get("version")), reason: form.get("reason"), decision: form.get("decision") }); refresh(); return { id, message: "Revisão do fechamento registrada." }; });
}

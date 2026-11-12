"use server";
import { revalidatePath } from "next/cache";
import { erpAction } from "./action-result";
import { confirmPayoutPayment, preparePayout, registerPayoutPayment, reviewPayout } from "./payouts";
import type { ErpActionResult } from "./contracts";

function refresh(id?: string) { revalidatePath("/financeiro", "layout"); if (id) revalidatePath(`/financeiro/repasses/${id}`); }

export async function preparePayoutAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => {
    const id = await preparePayout({ requestId: form.get("requestId"), beneficiaryId: form.get("beneficiaryId"), competence: form.get("competence"), entryIds: form.getAll("entryId") });
    refresh(id); return { id, message: "Repasse preparado. Outra pessoa autorizada deve conferir e aprovar." };
  });
}
export async function reviewPayoutAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => {
    const id = await reviewPayout({ id: form.get("id"), expectedVersion: Number(form.get("version")), decision: form.get("decision"), reason: form.get("reason") });
    refresh(id); return { id, message: form.get("decision") === "approve" ? "Repasse aprovado para pagamento." : "Repasse cancelado. As comissões voltaram a ficar disponíveis." };
  });
}
export async function registerPayoutPaymentAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => {
    const id = await registerPayoutPayment({ id: form.get("id"), expectedVersion: Number(form.get("version")), requestId: form.get("requestId"), occurredOn: form.get("occurredOn"), evidenceDocumentId: form.get("evidenceDocumentId"), reason: form.get("reason") });
    refresh(id); return { id, message: "Pagamento registrado. Outra pessoa deve conferir o comprovante para emitir o recibo." };
  });
}
export async function confirmPayoutPaymentAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => {
    const id = await confirmPayoutPayment({ id: form.get("id"), expectedVersion: Number(form.get("version")), decision: form.get("decision"), reason: form.get("reason") });
    refresh(id); return { id, message: form.get("decision") === "confirm" ? "Pagamento conferido e recibo emitido." : "Pagamento rejeitado. O repasse voltou para aprovado." };
  });
}

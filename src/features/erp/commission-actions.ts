"use server";
import { revalidatePath } from "next/cache";
import { erpAction } from "./action-result";
import { bringScheduleToConference } from "./commissions";
import type { ErpActionResult } from "./contracts";

export async function bringScheduleAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => {
    const result = await bringScheduleToConference({ saleId: form.get("saleId") });
    revalidatePath("/financeiro", "layout");
    return { message: result.created ? `${result.created} parcela(s) enviada(s) para conferência. Anexe a evidência e peça a aprovação independente.` : "Nenhuma parcela pendente nova para conferir nesta venda." };
  });
}

"use server";
import { revalidatePath } from "next/cache";
import { erpAction } from "./action-result";
import { reviewErpImport } from "./imports";
import type { ErpActionResult } from "./contracts";

export async function reviewErpImportAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => {
    const id = await reviewErpImport({ id: form.get("id"), version: Number(form.get("version")), decision: form.get("decision"), reason: form.get("reason"), confirmed: form.get("confirmed") === "on" });
    revalidatePath("/administracao/importacoes"); revalidatePath(`/administracao/importacoes/${id}`); revalidatePath("/implantacoes");
    return { id, message: "Lote atualizado. Confira o resultado e o histórico." };
  });
}

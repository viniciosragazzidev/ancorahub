"use server";

import { revalidatePath } from "next/cache";
import type { ErpActionResult } from "./contracts";
import { erpAction } from "./action-result";
import { saveErpModule } from "./governance";

export async function saveErpModuleAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => {
    await saveErpModule({ module: form.get("module"), enabled: form.get("enabled") === "on", roles: form.getAll("roles"), maxImportRows: Number(form.get("maxImportRows")), expectedVersion: Number(form.get("version")),
      ...(form.get("module") === "tv" ? { params: { showNames: form.get("showNames") === "on", intervalSeconds: Number(form.get("intervalSeconds")) } } : {}) });
    revalidatePath("/administracao/erp"); revalidatePath("/", "layout");
    return { message: "Configuração salva. O acesso continua limitado ao papel e ao escopo de cada pessoa." };
  });
}

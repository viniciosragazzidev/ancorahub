import "server-only";
import { z } from "zod";
import { ErpError, type ErpActionResult } from "./contracts";

export async function erpAction(work: () => Promise<{ message: string; id?: string }>): Promise<ErpActionResult> {
  try { return { ok: true, ...await work() }; }
  catch (error) {
    if (error instanceof ErpError) return { ok: false, message: error.message };
    if (error instanceof z.ZodError) return { ok: false, message: error.issues[0]?.message ?? "Confira os campos informados." };
    console.error("erp.action_failed", { correlationId: crypto.randomUUID(), errorType: error instanceof Error ? error.name : "unknown" });
    return { ok: false, message: "Não foi possível concluir. Atualize a página e tente novamente; se persistir, procure o administrador." };
  }
}

"use client";
import { z } from "zod";
import type { ErpActionResult } from "./contracts";

const resultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), id: z.string().uuid().optional(), message: z.string() }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);

export async function submitErpFile(path: "/api/erp/evidence" | "/api/erp/imports", form: FormData): Promise<ErpActionResult> {
  try {
    const response = await fetch(path, { method: "POST", credentials: "same-origin", body: form });
    const parsed = resultSchema.safeParse(await response.json());
    if (!parsed.success) return { ok: false, message: "Resposta indisponível. Atualize a página e tente novamente." };
    return parsed.data;
  } catch { return { ok: false, message: "O envio não foi concluído. Verifique sua conexão e tente novamente." }; }
}

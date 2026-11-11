"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { agendarRetorno, CarteiraRetornoError, reagendarRetorno } from "./retorno-servico";

export type RetornoActionResult = { ok: true; repeated?: boolean; changed?: boolean } | { ok: false; error: string };

const agendarInput = z.object({
  leadId: z.string().uuid(),
  clientId: z.string().uuid(),
  dueAt: z.string().max(40).nullable(),
  note: z.string().max(1000).nullable().optional(),
});

const reagendarInput = z.object({
  taskId: z.string().uuid(),
  clientId: z.string().uuid(),
  dueAt: z.string().max(40).nullable(),
});

function mensagem(error: unknown, fallback: string) {
  if (error instanceof CarteiraRetornoError) return error.message;
  // Detalhe técnico fica no log; o corretor vê só a mensagem genérica.
  console.error("[carteira-retorno] falha", error instanceof Error ? error.name : "unknown");
  return fallback;
}

/** Agenda o retorno do cliente (tarefa canônica do lead). Repetição não cria outro retorno. */
export async function agendarRetornoAction(raw: unknown): Promise<RetornoActionResult> {
  const parsed = agendarInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos. Confira a data e tente de novo." };
  try {
    const context = await getRequiredTenantContext();
    const result = await agendarRetorno(context, { leadId: parsed.data.leadId, dueAt: parsed.data.dueAt, note: parsed.data.note ?? null });
    revalidatePath(`/clientes/${parsed.data.clientId}`);
    revalidatePath("/dashboard");
    return { ok: true, repeated: result.repeated };
  } catch (error) {
    return { ok: false, error: mensagem(error, "Não foi possível agendar o retorno. Tente de novo.") };
  }
}

/** Muda o prazo de um retorno aberto do próprio corretor. */
export async function reagendarRetornoAction(raw: unknown): Promise<RetornoActionResult> {
  const parsed = reagendarInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos. Confira a data e tente de novo." };
  try {
    const context = await getRequiredTenantContext();
    const result = await reagendarRetorno(context, { taskId: parsed.data.taskId, dueAt: parsed.data.dueAt });
    revalidatePath(`/clientes/${parsed.data.clientId}`);
    revalidatePath("/dashboard");
    return { ok: true, changed: result.changed };
  } catch (error) {
    return { ok: false, error: mensagem(error, "Não foi possível reagendar o retorno. Tente de novo.") };
  }
}

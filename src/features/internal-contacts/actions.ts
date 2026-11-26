"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { setSystemSetting } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { findLeadPhones, findOwnAccountPhone, getOwnAccountPhones } from "./account-phones";
import { formatInternalPhone, MAX_INTERNAL_NUMBERS, parseInternalNumberLines } from "./decision";
import { internalNumbersKey, invalidateInternalDirectory } from "./queries";

export type InternalNumbersResult =
  | { success: true; count: number; warnings: string[] }
  | { success: false; error: string };

/** Só o diretor muda a lista "Números internos". Recusa o número da própria conta e avisa quando o número é de um lead. */
export async function saveInternalNumbersAction(text: string): Promise<InternalNumbersResult> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { success: false, error: "Só o diretor altera os números internos." };
    const parsed = parseInternalNumberLines(String(text ?? ""));
    if (parsed.invalid.length) return { success: false, error: `Número inválido: ${parsed.invalid[0]}. Use DDD e número.` };
    if (parsed.numbers.length > MAX_INTERNAL_NUMBERS) return { success: false, error: `No máximo ${MAX_INTERNAL_NUMBERS} números internos.` };
    const phones = parsed.numbers.map((item) => item.phone);
    const own = findOwnAccountPhone(phones, await getOwnAccountPhones(context.tenantId));
    if (own) return { success: false, error: `${formatInternalPhone(own)} é um número da própria conta. Ele não precisa entrar na lista.` };

    await setSystemSetting(internalNumbersKey(context.tenantId), JSON.stringify(parsed.numbers));
    invalidateInternalDirectory(context.tenantId);
    await getDatabase().insert(schema.auditLogs).values({
      id: randomUUID(), userId: context.userId, entidade: "tenant", entidadeId: context.tenantId,
      acao: "internal_contacts.updated", metadata: { count: parsed.numbers.length },
    });
    const leads = await findLeadPhones(context.tenantId, phones).catch(() => []);
    const warnings = [
      ...leads.map((item) => `${formatInternalPhone(item.phone)} é do lead ${item.leadName}. As mensagens dele não chegam mais à IA nem à distribuição.`),
      ...(parsed.repeated.length ? [`${parsed.repeated.length === 1 ? "Uma linha repetida ficou" : `${parsed.repeated.length} linhas repetidas ficaram`} de fora.`] : []),
    ];
    revalidatePath("/settings");
    return { success: true, count: parsed.numbers.length, warnings };
  } catch {
    return { success: false, error: "Não deu para salvar os números internos agora." };
  }
}

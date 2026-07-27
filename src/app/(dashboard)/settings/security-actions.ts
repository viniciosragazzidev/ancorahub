"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

const securityAction = z.enum([
  "ativou_2fa",
  "desativou_2fa",
  "gerou_codigos_backup",
  "cadastrou_passkey",
  "renomeou_passkey",
  "excluiu_passkey",
  "dispensou_toast_passkey",
]);

export async function recordSecurityAuditAction(action: string) {
  const context = await getRequiredTenantContext();
  const parsed = securityAction.safeParse(action);
  if (!parsed.success) return { success: false as const, error: "Ação de segurança inválida." };

  await getDatabase().insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "user",
    entidadeId: context.userId,
    acao: parsed.data,
  });
  return { success: true as const };
}

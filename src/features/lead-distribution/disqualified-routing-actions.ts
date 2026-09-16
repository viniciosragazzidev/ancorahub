"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

const inputSchema = z.object({ holdDisqualifiedLeads: z.boolean() });

export type DisqualifiedRoutingSettingInput = z.infer<typeof inputSchema>;

function isMissingMigration(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  return candidate?.code === "42703" && /hold_disqualified_leads/i.test(candidate.message ?? "");
}

export async function saveDisqualifiedRoutingSettingAction(
  input: DisqualifiedRoutingSettingInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") {
    return { success: false, error: "Apenas o Diretor pode alterar esta regra global." };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Configuração inválida." };
  }

  try {
    const db = getDatabase();
    await db.transaction(async (tx) => {
      await tx
        .update(schema.tenants)
        .set({ holdDisqualifiedLeads: parsed.data.holdDisqualifiedLeads, updatedAt: new Date() })
        .where(eq(schema.tenants.id, context.tenantId));

      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "tenant",
        entidadeId: context.tenantId,
        acao: parsed.data.holdDisqualifiedLeads
          ? "tenant.disqualified_leads_held"
          : "tenant.disqualified_leads_released",
      });
    });

    revalidatePath("/distribuicao");
    revalidatePath("/leads/distribuicao");
    return { success: true };
  } catch (error) {
    if (isMissingMigration(error)) {
      return {
        success: false,
        error: "O banco ainda não recebeu a migration 0148. Aplique-a no serviço da API e tente novamente.",
      };
    }
    console.error("[disqualified-routing] save.failed", {
      tenantId: context.tenantId,
      error: error instanceof Error ? error.name : "unknown_error",
    });
    return { success: false, error: "Não foi possível salvar a regra para leads desqualificados." };
  }
}

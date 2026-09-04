"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { hasCapability } from "@/shared/auth/permissions";

const brokerAcceptanceSlaSchema = z.object({
  slaFirstContactMinutes: z.number().int().min(1).max(1440),
  autoRedistribute: z.boolean().default(true),
});

export type BrokerAcceptanceSlaInput = z.infer<typeof brokerAcceptanceSlaSchema>;

export async function saveBrokerAcceptanceSlaAction(
  input: BrokerAcceptanceSlaInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") {
      return { success: false, error: "Permissão insuficiente para alterar configurações de distribuição." };
    }

    const parsed = brokerAcceptanceSlaSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Tempo de SLA inválido (deve ser entre 1 e 1440 minutos)." };
    }

    const db = getDatabase();

    await db.transaction(async (tx) => {
      await tx
        .update(schema.tenants)
        .set({
          slaFirstContactMinutes: String(parsed.data.slaFirstContactMinutes),
          autoRedistributeOnFeedbackTimeout: parsed.data.autoRedistribute,
          updatedAt: new Date(),
        })
        .where(eq(schema.tenants.id, context.tenantId));

      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "tenant",
        entidadeId: context.tenantId,
        acao: "tenant.update_broker_acceptance_sla",
      });
    });

    revalidatePath("/leads/distribuicao");
    revalidatePath("/distribuicao");

    return { success: true };
  } catch (err) {
    console.error("[saveBrokerAcceptanceSlaAction] error:", err);
    return { success: false, error: "Erro ao salvar parâmetros de SLA de aceite." };
  }
}

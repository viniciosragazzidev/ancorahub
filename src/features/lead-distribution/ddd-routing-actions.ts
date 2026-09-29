"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { setSystemSetting } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { normalizeDddRoutingSettings } from "./ddd-routing";
import { dddRoutingSettingKey } from "./ddd-routing-settings";

const queueId = z.string().trim().min(1).max(120).nullable();
const inputSchema = z.object({
  enabled: z.boolean(),
  validDdds: z.array(z.string().regex(/^\d{2}$/)).max(67),
  queues: z.object({ valid: queueId, invalid: queueId, unknown: queueId }),
});

export type DddRoutingSettingsInput = z.infer<typeof inputSchema>;

export async function saveDddRoutingSettingsAction(
  input: DddRoutingSettingsInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") {
    return { success: false, error: "Apenas o Diretor pode alterar a regra de DDD, que vale para a empresa inteira." };
  }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Configuração inválida." };

  const settings = normalizeDddRoutingSettings(parsed.data);
  if (settings.enabled && !settings.validDdds.length) {
    return { success: false, error: "Selecione ao menos um DDD válido antes de ativar a regra." };
  }

  const db = getDatabase();
  const queueIds = [...new Set(Object.values(settings.queues).filter((id): id is string => Boolean(id)))];
  if (queueIds.length) {
    const found = await db.select({ id: schema.leadQueues.id }).from(schema.leadQueues).where(and(
      eq(schema.leadQueues.tenantId, context.tenantId),
      eq(schema.leadQueues.status, "active"),
      inArray(schema.leadQueues.id, queueIds),
    ));
    if (found.length !== queueIds.length) return { success: false, error: "Uma das filas escolhidas não existe ou está inativa." };
  }

  try {
    await setSystemSetting(dddRoutingSettingKey(context.tenantId), JSON.stringify(settings));
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "tenant",
      entidadeId: context.tenantId,
      acao: settings.enabled ? "tenant.ddd_routing_updated" : "tenant.ddd_routing_disabled",
    });
    revalidatePath("/leads/distribuicao");
    return { success: true };
  } catch (error) {
    console.error("[ddd-routing] save.failed", { tenantId: context.tenantId, error: error instanceof Error ? error.name : "unknown_error" });
    return { success: false, error: "Não foi possível salvar a regra de DDD." };
  }
}

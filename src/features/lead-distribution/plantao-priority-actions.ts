"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { setSystemSetting } from "@/features/system-settings/queries";
import { requireCargoCapability } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getPlantaoPrioritySettings } from "./plantao-priority";
import { normalizePlantaoPrioritySettings, PLANTAO_WEIGHT_MAX, PLANTAO_WEIGHT_MIN, plantaoPrioritySettingKey } from "./plantao-priority-core";

const inputSchema = z.object({
  mode: z.enum(["off", "shadow", "on"]),
  levelByHours: z.boolean(),
  types: z.array(z.object({
    typeId: z.string().trim().min(1).max(120),
    base: z.number().min(PLANTAO_WEIGHT_MIN).max(PLANTAO_WEIGHT_MAX),
    adaptive: z.boolean(),
  })).max(100),
});

export type PlantaoPrioritySettingsInput = z.infer<typeof inputSchema>;

/**
 * Prioridade por tipo de plantão (2026-11-10): só o Diretor altera, vale para a
 * empresa inteira e toda mudança vai para audit_logs com o antes e o depois.
 */
export async function savePlantaoPrioritySettingsAction(
  input: PlantaoPrioritySettingsInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const context = await getRequiredTenantContext();
  await requireCargoCapability(context, "distribution_settings_manage");
  if (context.role !== "director") {
    return { success: false, error: "Apenas o Diretor pode alterar a prioridade por tipo de plantão." };
  }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Configuração inválida: o peso vai de 1,0 a 1,3." };

  const db = getDatabase();
  const typeIds = [...new Set(parsed.data.types.map((type) => type.typeId))];
  if (typeIds.length) {
    const found = await db.select({ id: schema.dutyScheduleTypes.id }).from(schema.dutyScheduleTypes).where(and(
      eq(schema.dutyScheduleTypes.tenantId, context.tenantId),
      inArray(schema.dutyScheduleTypes.id, typeIds),
    ));
    if (found.length !== typeIds.length) return { success: false, error: "Um dos tipos de plantão não existe nesta empresa." };
  }

  try {
    const previous = await getPlantaoPrioritySettings(context.tenantId);
    // Tipos com peso 1 e sem adaptativo não precisam ficar gravados.
    const types = Object.fromEntries(parsed.data.types
      .filter((type) => type.base > PLANTAO_WEIGHT_MIN || type.adaptive)
      .map((type) => [type.typeId, { base: type.base, adaptive: type.adaptive }]));
    const next = normalizePlantaoPrioritySettings({
      ...previous,
      mode: parsed.data.mode,
      levelByHours: parsed.data.levelByHours,
      types,
      // O cálculo adaptativo só vale para tipos ainda configurados.
      computed: Object.fromEntries(Object.entries(previous.computed).filter(([typeId]) => typeId in types)),
    });
    await setSystemSetting(plantaoPrioritySettingKey(context.tenantId), JSON.stringify(next));
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "tenant",
      entidadeId: context.tenantId,
      acao: next.mode === "off" ? "tenant.plantao_priority_disabled" : "tenant.plantao_priority_updated",
      metadata: {
        before: { mode: previous.mode, levelByHours: previous.levelByHours, types: previous.types },
        after: { mode: next.mode, levelByHours: next.levelByHours, types: next.types },
      },
    });
    revalidatePath("/leads/distribuicao");
    return { success: true };
  } catch (error) {
    console.error("[plantao-priority] save.failed", { tenantId: context.tenantId, error: error instanceof Error ? error.name : "unknown_error" });
    return { success: false, error: "Não foi possível salvar a prioridade por tipo de plantão." };
  }
}

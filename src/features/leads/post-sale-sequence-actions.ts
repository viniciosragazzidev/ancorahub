"use server";

import { randomUUID } from "node:crypto";

import { setSystemSetting } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import {
  POST_SALE_SEQUENCE_STEP_IDS,
  postSaleSequenceSettingKey,
  serializePostSaleSequenceSettings,
  validatePostSaleSequenceInput,
  type PostSaleSequenceSettings,
} from "./post-sale-sequence-core";

export type PostSaleSequenceActionState = { success: boolean; error?: string; settings?: PostSaleSequenceSettings };

/** Só o diretor liga, desliga e ajusta a sequência de pós-venda da empresa. Vale para as próximas vendas. */
export async function updatePostSaleSequenceAction(_prev: PostSaleSequenceActionState, formData: FormData): Promise<PostSaleSequenceActionState> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { success: false, error: "Só o diretor altera a sequência de pós-venda." };

    const result = validatePostSaleSequenceInput({
      enabled: formData.get("enabled"),
      steps: POST_SALE_SEQUENCE_STEP_IDS.map((id) => ({ id, days: formData.get(`days-${id}`), title: formData.get(`title-${id}`) })),
    });
    if (!result.ok) return { success: false, error: result.error };

    await setSystemSetting(postSaleSequenceSettingKey(context.tenantId), serializePostSaleSequenceSettings(result.settings));
    await getDatabase().insert(schema.auditLogs).values({
      id: randomUUID(), userId: context.userId, entidade: "tenant", entidadeId: context.tenantId, acao: "atualizou_sequencia_pos_venda",
      metadata: { enabled: result.settings.enabled, steps: result.settings.steps },
    });
    return { success: true, settings: result.settings };
  } catch {
    return { success: false, error: "Não deu para salvar a sequência de pós-venda agora." };
  }
}

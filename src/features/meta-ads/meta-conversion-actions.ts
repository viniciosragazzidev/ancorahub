"use server";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import {
  getMetaConversionsPanel,
  listMetaConversionRefusals,
  retryMetaConversionRefusals,
  saveMetaConversionSettings,
  type MetaConversionRefusal,
  type MetaConversionsPanel,
} from "./meta-conversion-service";

const DIRECTOR_ONLY = "Apenas o Diretor pode alterar o envio de etapas para a Meta.";

/** Lead stage events to Meta are a director decision: only the director sees and changes them. */
export async function getMetaConversionsPanelAction(): Promise<MetaConversionsPanel | null> {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") return null;
  return getMetaConversionsPanel(context.tenantId);
}

export async function saveMetaConversionSettingsAction(input: {
  enabled: boolean;
  datasetId: string | null;
  testEventCode: string | null;
}): Promise<{ success: true; backfilled: number } | { success: false; error: string }> {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") return { success: false, error: DIRECTOR_ONLY };
  try {
    const { backfilled } = await saveMetaConversionSettings({
      tenantId: context.tenantId,
      userId: context.userId,
      enabled: input.enabled === true,
      datasetId: typeof input.datasetId === "string" ? input.datasetId.slice(0, 64) : null,
      testEventCode: typeof input.testEventCode === "string" ? input.testEventCode.slice(0, 64) : null,
    });
    return { success: true, backfilled };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível salvar agora." };
  }
}

/** Etapas recusadas pela Meta, só da empresa do Diretor. */
export async function listMetaConversionRefusalsAction(): Promise<{ success: true; refusals: MetaConversionRefusal[] } | { success: false; error: string }> {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") return { success: false, error: "Apenas o Diretor vê as etapas recusadas pela Meta." };
  try {
    return { success: true, refusals: await listMetaConversionRefusals({ tenantId: context.tenantId }) };
  } catch {
    return { success: false, error: "Não foi possível carregar as recusas agora." };
  }
}

export type MetaConversionRetryActionResult =
  | { success: true; requeued: number; refused: Array<{ id: string; cause: string }> }
  | { success: false; error: string };

/**
 * Devolve uma recusa (`id`) ou todas as elegíveis (`all`) para a fila do job meta-conversions. Nunca chama a Meta
 * daqui. Com um id só, a recusa que não pode voltar responde como erro com a causa.
 */
export async function retryMetaConversionRefusalsAction(input: { id: string } | { all: true }): Promise<MetaConversionRetryActionResult> {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") return { success: false, error: DIRECTOR_ONLY };
  const ids = "all" in input && input.all === true
    ? ("all" as const)
    : "id" in input && typeof input.id === "string" && input.id.trim()
      ? [input.id.trim().slice(0, 64)]
      : null;
  if (!ids) return { success: false, error: "Escolha a etapa para tentar de novo." };
  try {
    const result = await retryMetaConversionRefusals({ tenantId: context.tenantId, userId: context.userId, ids });
    if (!result.requeued) {
      return { success: false, error: ids === "all" ? "Nenhuma recusa pode voltar para a fila agora." : result.refused[0]?.cause ?? "Esta etapa não pode voltar para a fila." };
    }
    return { success: true, requeued: result.requeued, refused: result.refused };
  } catch {
    return { success: false, error: "Não foi possível devolver para a fila agora." };
  }
}

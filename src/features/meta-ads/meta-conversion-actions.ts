"use server";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { getMetaConversionsPanel, saveMetaConversionSettings, type MetaConversionsPanel } from "./meta-conversion-service";

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
  if (context.role !== "director") return { success: false, error: "Apenas o Diretor pode alterar o envio de etapas para a Meta." };
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

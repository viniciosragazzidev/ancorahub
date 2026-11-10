"use server";

import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireRole } from "@/shared/auth/authorization";

import { sendPlantaoReportForTenant, setPlantaoReportEnabled } from "./plantao-report";

export async function setPlantaoReportEnabledAction(enabled: boolean) {
  const context = requireRole(await getRequiredTenantContext(), "director");
  if (typeof enabled !== "boolean") return { ok: false as const, error: "A opção de ativação é inválida." };
  try {
    const config = await setPlantaoReportEnabled(context.tenantId, context.userId, enabled);
    revalidatePath("/settings/resultado-plantao");
    return { ok: true as const, enabled: config.enabled };
  } catch (error) {
    console.error("[plantao-report-action] toggle_failed", { tenantId: context.tenantId, error: error instanceof Error ? error.message.slice(0, 140) : "unknown" });
    return { ok: false as const, error: "Não foi possível salvar a configuração. Tente novamente." };
  }
}

export async function sendPlantaoReportNowAction() {
  const context = requireRole(await getRequiredTenantContext(), "director");
  try {
    const result = await sendPlantaoReportForTenant(context.tenantId, { actorUserId: context.userId, manual: true });
    revalidatePath("/settings/resultado-plantao");
    if (result.state === "sent") return { ok: true as const, message: "Relatório enviado ao grupo configurado." };
    if (result.state === "duplicate") return { ok: false as const, error: "Já existe um envio ou tentativa registrada para hoje. Para evitar mensagens duplicadas, não foi enviado novamente." };
    if (result.state === "disabled") return { ok: false as const, error: result.reason === "feature_disabled" ? "O recurso está desativado pelo Super-admin." : "Ative o relatório antes de enviar." };
    if (result.state === "failed") return { ok: false as const, error: result.reason };
    return { ok: false as const, error: "O relatório ainda não foi enviado." };
  } catch (error) {
    console.error("[plantao-report-action] manual_send_failed", { tenantId: context.tenantId, error: error instanceof Error ? error.message.slice(0, 140) : "unknown" });
    return { ok: false as const, error: "Não foi possível preparar o envio. Revise a configuração e tente novamente." };
  }
}

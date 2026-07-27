"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export async function updateFeedbackSettingsAction(
  _prev: { success: boolean; error?: string },
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") {
      return { success: false, error: "Apenas diretores e gestores podem alterar a configuração de feedback." };
    }

    const interval = Number.parseInt(String(formData.get("feedbackReminderInterval") ?? "30"), 10);
    const maxAttempts = Number.parseInt(String(formData.get("feedbackReminderMaxAttempts") ?? "5"), 10);
    const maxActiveLeadsLimit = Number.parseInt(String(formData.get("maxActiveLeadsLimit") ?? "10"), 10);
    const pushEnabled = formData.get("feedbackPushEnabled") === "true";
    const toastEnabled = formData.get("feedbackToastEnabled") === "true";
    const feedbackRequiredEnabled = formData.get("feedbackRequiredEnabled") === "true";

    if (Number.isNaN(interval) || interval < 1 || interval > 1440) {
      return { success: false, error: "Intervalo deve ser entre 1 e 1440 minutos." };
    }
    if (Number.isNaN(maxAttempts) || maxAttempts < 1 || maxAttempts > 50) {
      return { success: false, error: "Máximo de tentativas deve ser entre 1 e 50." };
    }
    if (Number.isNaN(maxActiveLeadsLimit) || maxActiveLeadsLimit < 1 || maxActiveLeadsLimit > 100) {
      return { success: false, error: "Limite máximo de leads deve ser entre 1 e 100." };
    }

    const db = getDatabase();
    await db.transaction(async (tx) => {
      await tx.update(schema.tenants)
        .set({
          feedbackReminderIntervalMinutes: String(interval),
          feedbackReminderMaxAttempts: maxAttempts,
          feedbackPushEnabled: pushEnabled,
          feedbackToastEnabled: toastEnabled,
          feedbackRequiredEnabled,
          maxActiveLeadsLimit,
          updatedAt: new Date(),
        })
        .where(eq(schema.tenants.id, context.tenantId));

      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "tenant",
        entidadeId: context.tenantId,
        acao: "atualizou_configuracao_feedback",
      });
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao salvar configuração de feedback.";
    return { success: false, error: message };
  }
}

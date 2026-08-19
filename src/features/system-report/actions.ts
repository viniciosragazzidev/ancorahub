"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  getPreferredMetaCloudChannel,
  isMetaCloudWhatsAppEnabled,
  sendMetaCloudChannelText,
} from "@/features/communication-channels/service";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getUserDisplayInfo } from "@/shared/auth/actions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import {
  SYSTEM_REPORT_DESTINATION_KEY,
  SYSTEM_REPORT_ENABLED_KEY,
  SYSTEM_REPORT_TRIGGERS,
  buildSystemReportMessage,
  getSystemReportTrigger,
  type SystemReportTriggerId,
} from "./message";

const reportSchema = z.object({
  triggerId: z.enum(SYSTEM_REPORT_TRIGGERS.map((trigger) => trigger.id) as [SystemReportTriggerId, ...SystemReportTriggerId[]]),
  message: z.string().trim().min(1, "Descreva o problema para que o responsável possa ajudar.").max(2000, "A descrição deve ter no máximo 2.000 caracteres."),
});

export type SystemReportActionState = { success?: string; error?: string };

export async function sendSystemReportAction(_: SystemReportActionState, formData: FormData): Promise<SystemReportActionState> {
  const parsed = reportSchema.safeParse({
    triggerId: formData.get("triggerId"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const context = await getRequiredTenantContext();
  const info = await getUserDisplayInfo();

  const enabled = await getSystemSetting(SYSTEM_REPORT_ENABLED_KEY);
  if (enabled === "false" || enabled === "disabled") {
    return { error: "A central de report de problemas está desativada." };
  }
  if (!(await isMetaCloudWhatsAppEnabled())) {
    return { error: "A integração oficial da Meta está desativada pelo Super-admin." };
  }

  const destination = await getSystemSetting(SYSTEM_REPORT_DESTINATION_KEY);
  if (!destination) {
    return { error: "O destino dos reports ainda não foi configurado." };
  }

  const channel = await getPreferredMetaCloudChannel({ tenantId: context.tenantId, userId: context.userId });
  if (!channel) {
    return { error: "Esta corretora ainda não possui um número oficial da Meta Cloud ativo." };
  }

  const trigger = getSystemReportTrigger(parsed.data.triggerId);
  if (!trigger) return { error: "Motivo do report inválido." };

  const body = buildSystemReportMessage({
    cargo: info.role ?? "Usuário",
    nome: info.name,
    titulo: trigger.label,
    mensagem: parsed.data.message,
  });

  try {
    const { messageId } = await sendMetaCloudChannelText({ channel, to: destination, body });
    await getDatabase().insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "system_report",
      entidadeId: messageId,
      acao: "system_report.sent",
      createdAt: new Date(),
    });
    return { success: "Report enviado. O responsável foi notificado pelo WhatsApp." };
  } catch (error) {
    console.error("[system-report] send.failed", {
      tenantId: context.tenantId,
      error: error instanceof Error ? error.message.slice(0, 240) : "unknown_error",
    });
    return { error: error instanceof Error ? error.message : "Não foi possível enviar o report." };
  }
}
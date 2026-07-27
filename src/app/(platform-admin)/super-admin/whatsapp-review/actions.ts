"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isMetaCloudWhatsAppEnabled } from "@/features/communication-channels/service";
import { sendWhatsAppReviewMessage } from "@/features/communication-channels/review-message-service";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getDatabase, schema } from "@/shared/db";

const reviewFormSchema = z.object({
  to: z.string().trim().min(8, "Informe o telefone com código do país.").max(24),
  message: z.string().trim().min(1, "Digite uma mensagem.").max(4096, "A mensagem deve ter no máximo 4.096 caracteres."),
});

export type WhatsAppReviewActionState = { success?: string; error?: string; messageId?: string };

export async function sendWhatsAppReviewMessageAction(_: WhatsAppReviewActionState, formData: FormData): Promise<WhatsAppReviewActionState> {
  const parsed = reviewFormSchema.safeParse({ to: formData.get("to"), message: formData.get("message") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const admin = await getRequiredPlatformAdmin();
  if (!(await isMetaCloudWhatsAppEnabled())) return { error: "A integração oficial da Meta está desativada pelo Super-admin." };

  try {
    const result = await sendWhatsAppReviewMessage(parsed.data);
    await getDatabase().insert(schema.platformAuditLogs).values({
      id: randomUUID(),
      actorUserId: admin.userId,
      action: "meta_cloud_whatsapp.review_message_sent",
      targetType: "whatsapp_review",
      targetId: result.messageId,
      metadata: { recipientHash: createHash("sha256").update(parsed.data.to.replace(/\D/g, "")).digest("hex"), provider: "meta_cloud" },
      createdAt: new Date(),
    });
    revalidatePath("/super-admin/whatsapp-review");
    return { success: "Mensagem enviada. Confirme o recebimento no WhatsApp.", messageId: result.messageId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível enviar a mensagem de revisão." };
  }
}

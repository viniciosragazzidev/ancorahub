"use server";

import { z } from "zod";

import { startLeadServiceAction } from "@/app/(dashboard)/leads/[id]/service-action";
import type { ChatServerActionName } from "@/components/chat/types";
import { acceptLeadOfferAction } from "@/features/leads/accept-offer-action";
import { updateBrokerAvailabilityAction } from "@/features/leads/availability-action";
import { declineLeadAction } from "@/features/leads/decline-action";

export type ChatServerActionResult = { ok: boolean; message: string; href?: string };

const leadPayload = z.object({ leadId: z.string().min(1) });
const actionName = z.enum(["lead.accept", "lead.decline", "lead.registerContact", "lead.changeStep", "lead.scheduleReturn", "lead.markLost", "duty.pause", "duty.resume", "notifications.markRead"]);

/**
 * Runs the server action behind a suggested reply. Every branch calls an
 * action the broker app already had (same checks and audit); the chat only
 * changes how it is asked.
 */
export async function runChatServerAction(name: ChatServerActionName, payload: Record<string, unknown>): Promise<ChatServerActionResult> {
  try {
    switch (actionName.parse(name)) {
      case "lead.accept": {
        const { leadId } = leadPayload.parse(payload);
        const result = await acceptLeadOfferAction(leadId);
        return result.success
          ? { ok: true, message: "Aceito. O lead agora é seu: abra a conversa dele para fazer o primeiro contato.", href: `/leads/${leadId}` }
          : { ok: false, message: result.error ?? "Não consegui aceitar esse lead." };
      }
      case "lead.decline": {
        const { leadId, reason } = leadPayload.extend({ reason: z.string().min(2).max(200) }).parse(payload);
        const result = await declineLeadAction(leadId, reason);
        return result.success ? { ok: true, message: "Recusado. Ele volta para a fila e vai para outro corretor." } : { ok: false, message: result.error ?? "Não consegui recusar esse lead." };
      }
      case "lead.registerContact": {
        const { leadId } = leadPayload.parse(payload);
        const form = new FormData();
        form.set("leadId", leadId);
        const result = await startLeadServiceAction({}, form);
        return result.success
          ? { ok: true, message: "Contato registrado. O atendimento começou.", href: result.whatsappUrl }
          : { ok: false, message: result.error ?? "Não consegui registrar o contato." };
      }
      case "duty.pause": {
        await updateBrokerAvailabilityAction("paused");
        // No automatic return yet: the broker resumes from the Plantão conversation.
        return { ok: true, message: "Pausei você. Para voltar a receber, abra o Plantão e toque em \"Voltar a receber\"." };
      }
      case "duty.resume": {
        await updateBrokerAvailabilityAction("available");
        return { ok: true, message: "Pronto, você voltou a receber leads." };
      }
      default:
        return { ok: false, message: "Isso se faz na conversa do lead. Abra o lead para continuar." };
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não consegui concluir agora." };
  }
}

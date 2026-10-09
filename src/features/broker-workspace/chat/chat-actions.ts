"use server";

import { z } from "zod";

import { startLeadServiceAction } from "@/app/(dashboard)/leads/[id]/service-action";
import { changeLeadStatusAction } from "@/app/(dashboard)/leads/status-actions";
import type { ChatServerActionName } from "@/components/chat/types";
import { acceptLeadOfferAction } from "@/features/leads/accept-offer-action";
import { updateBrokerAvailabilityAction } from "@/features/leads/availability-action";
import { addLeadNoteAction } from "@/features/leads/actions";
import { declineLeadAction } from "@/features/leads/decline-action";
import { MOTIVOS_PERDA } from "@/features/leads/lead-status-constants";
import { quickReminderAction } from "@/features/leads/reminder-actions";

/** warning: it worked, but part of it did not (shown as an alert, not as success). */
export type ChatServerActionResult = { ok: boolean; message: string; href?: string; warning?: boolean };

const leadPayload = z.object({ leadId: z.string().min(1) });
const actionName = z.enum(["lead.accept", "lead.decline", "lead.registerContact", "lead.changeStep", "lead.scheduleReturn", "lead.markLost", "lead.addNote", "duty.pause", "duty.resume", "notifications.markRead"]);

const whenPreset = z.enum(["today", "tomorrow", "in_2_days", "in_3_days"]);
const RETURN_TEXT: Record<z.infer<typeof whenPreset>, string> = {
  today: "hoje às 18h",
  tomorrow: "amanhã de manhã",
  in_2_days: "daqui a 2 dias",
  in_3_days: "daqui a 3 dias",
};

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

async function scheduleReturn(leadId: string, when: z.infer<typeof whenPreset>) {
  return quickReminderAction({}, form({ leadId, when }));
}

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
      case "lead.changeStep": {
        const { leadId, status, when } = leadPayload.extend({ status: z.enum(["quote_sent", "negotiation"]), when: whenPreset.optional() }).parse(payload);
        const result = await changeLeadStatusAction({}, form({ leadId, newStatus: status }));
        if (!result.success) return { ok: false, message: result.error ?? "Não consegui mudar a etapa." };
        const stage = status === "quote_sent" ? "Cotação enviada" : "Em negociação";
        if (!when) return { ok: true, message: `Pronto, etapa: ${stage}.` };
        const reminder = await scheduleReturn(leadId, when);
        return reminder.success
          ? { ok: true, message: `Pronto, etapa: ${stage}. Te lembro de acompanhar ${RETURN_TEXT[when]}.` }
          : { ok: true, warning: true, message: `Etapa: ${stage}. Mas não consegui criar o lembrete: ${reminder.error ?? "tente pela ficha"}.` };
      }
      case "lead.scheduleReturn": {
        const { leadId, when } = leadPayload.extend({ when: whenPreset }).parse(payload);
        const result = await scheduleReturn(leadId, when);
        return result.success
          ? { ok: true, message: `Combinado. Te lembro ${RETURN_TEXT[when]} e ele aparece na sua Agenda.` }
          : { ok: false, message: result.error ?? "Não consegui agendar o retorno." };
      }
      case "lead.markLost": {
        const { leadId, reason } = leadPayload.extend({ reason: z.enum(MOTIVOS_PERDA) }).parse(payload);
        const result = await changeLeadStatusAction({}, form({ leadId, newStatus: "lost", motivoPerda: reason }));
        return result.success
          ? { ok: true, message: "Registrei. O atendimento foi encerrado e conta no seu histórico." }
          : { ok: false, message: result.error ?? "Não consegui encerrar o atendimento." };
      }
      case "lead.addNote": {
        const { leadId, content } = leadPayload.extend({ content: z.string().trim().min(1).max(2000) }).parse(payload);
        const result = await addLeadNoteAction({}, form({ leadId, content }));
        return result.success ? { ok: true, message: "Anotei no histórico do lead." } : { ok: false, message: result.error ?? "Não consegui salvar a nota." };
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

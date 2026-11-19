"use server";

import { z } from "zod";

import { startLeadServiceAction } from "@/app/(dashboard)/leads/[id]/service-action";
import { markAllNotificationsReadAction } from "@/app/(dashboard)/notificacoes/actions";
import { changeLeadStatusAction } from "@/app/(dashboard)/leads/status-actions";
import type { ChatServerActionName } from "@/components/chat/types";
import { acceptLeadOfferAction } from "@/features/leads/accept-offer-action";
import { updateBrokerAvailabilityAction } from "@/features/leads/availability-action";
import { addLeadNoteAction } from "@/features/leads/actions";
import { clientMessageIdSchema } from "@/features/leads/note-idempotency";
import { declineLeadAction } from "@/features/leads/decline-action";
import { MOTIVOS_PERDA } from "@/features/leads/lead-status-constants";
import { quickReminderAction } from "@/features/leads/reminder-actions";
import { setLeadTaskDoneAction } from "@/features/leads/task-actions";
import { acknowledgeAction } from "@/features/relationship/actions";
import { addBrokerToMyTeamAction } from "@/features/supervisor-workspace/actions";

/** warning: it worked, but part of it did not (shown as an alert, not as success). */
/** whatsapp: the client's WhatsApp link after an accept, opened in the same tap by the chat. */
export type ChatServerActionResult = { ok: boolean; message: string; href?: string; whatsapp?: string; warning?: boolean; undo?: { label: string; action: { kind: "server"; name: ChatServerActionName; payload: Record<string, string> } } };

const leadPayload = z.object({ leadId: z.string().min(1) });
const taskPayload = z.object({ taskId: z.string().uuid(), leadName: z.string().max(120).optional() });
const actionName = z.enum(["lead.accept", "lead.decline", "lead.registerContact", "lead.changeStep", "lead.scheduleReturn", "lead.completeReturn", "lead.cancelReturn", "lead.reopenReturn", "lead.undoReturn", "lead.restoreStep", "lead.markLost", "lead.addNote", "duty.pause", "duty.resume", "notifications.markRead", "relationship.ack", "team.addBroker"]);

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

/** Etapas para as quais um "Desfazer" pode voltar (nunca convertido nem perdido). */
const RESTORABLE_STEPS = ["new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis", "awaiting_reply"] as const;
const isoInstant = z.string().datetime({ offset: true });

async function scheduleReturn(leadId: string, when: string, replaceTaskId?: string) {
  return quickReminderAction({}, form({ leadId, when, ...(replaceTaskId ? { replaceTaskId } : {}) }));
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
          ? { ok: true, message: result.whatsappUrl ? "Aceito. Abrindo o WhatsApp do cliente com a mensagem pronta." : "Aceito. O lead agora é seu: o contato está na ficha.", href: `/leads/${leadId}`, whatsapp: result.whatsappUrl }
          : { ok: false, message: "O aceite não foi registrado. Toque de novo em alguns segundos." };
      }
      case "lead.decline": {
        const { leadId, reason } = leadPayload.extend({ reason: z.string().min(2).max(200) }).parse(payload);
        const result = await declineLeadAction(leadId, reason);
        return result.success ? { ok: true, message: "Recusado. Ele volta para a fila e vai para outro corretor." } : { ok: false, message: "A recusa não foi registrada. Toque de novo em alguns segundos." };
      }
      case "lead.registerContact": {
        const { leadId } = leadPayload.parse(payload);
        const form = new FormData();
        form.set("leadId", leadId);
        const result = await startLeadServiceAction({}, form);
        return result.success
          ? { ok: true, message: result.whatsappUrl ? "Lead aceito. O WhatsApp do cliente abre com a mensagem pronta: é só enviar." : "Lead aceito. Ele não tem WhatsApp no cadastro: veja o contato na ficha.", href: result.whatsappUrl }
          : { ok: false, message: "O contato não foi registrado. Toque de novo em alguns segundos." };
      }
      case "lead.changeStep": {
        const { leadId, status, when, previous } = leadPayload.extend({ status: z.enum(["quote_sent", "negotiation", "documentation_pending"]), when: whenPreset.optional(), previous: z.string().max(40).optional() }).parse(payload);
        const result = await changeLeadStatusAction({}, form({ leadId, newStatus: status }));
        if (!result.success) return { ok: false, message: "A etapa não foi alterada. Toque de novo em alguns segundos." };
        const stage = status === "quote_sent" ? "Cotação enviada" : status === "negotiation" ? "Em negociação" : "Documentação pendente";
        // A Sasá manda a etapa anterior: o "Desfazer" volta para ela.
        const restorable = Boolean(previous && (RESTORABLE_STEPS as readonly string[]).includes(previous) && previous !== status);
        const undo = restorable ? { label: "Desfazer", action: { kind: "server" as const, name: "lead.restoreStep" as const, payload: { leadId, status: previous! } } } : undefined;
        if (!when) return { ok: true, message: `Pronto, etapa: ${stage}.`, undo };
        const reminder = await scheduleReturn(leadId, when);
        return reminder.success
          ? { ok: true, message: `Pronto, etapa: ${stage}. Te lembro de acompanhar ${RETURN_TEXT[when]}.` }
          : { ok: true, warning: true, message: `Etapa: ${stage}. Não consegui criar o lembrete. Tente de novo pela ficha.` };
      }
      case "lead.scheduleReturn": {
        // `at` (hora exata, da Sasá) ou um atalho `when`; o servidor confere que o lead é do corretor.
        const { leadId, when, at, taskId } = leadPayload.extend({ when: whenPreset.optional(), at: isoInstant.optional(), taskId: z.string().uuid().optional() })
          .refine((value) => Boolean(value.when || value.at)).parse(payload);
        const result = await scheduleReturn(leadId, at ?? when!, taskId);
        if (!result.success) return { ok: false, message: "O retorno não foi agendado. Toque de novo em alguns segundos." };
        const undo = result.taskId ? { label: "Desfazer", action: { kind: "server" as const, name: "lead.undoReturn" as const, payload: { taskId: result.taskId, ...(taskId ? { reopenTaskId: taskId } : {}) } } } : undefined;
        return { ok: true, message: when ? `Combinado. Te lembro ${RETURN_TEXT[when]} e ele aparece na sua Agenda.` : "Combinado. O retorno está na sua Agenda.", undo };
      }
      case "lead.completeReturn": {
        const { taskId } = taskPayload.parse(payload);
        const result = await setLeadTaskDoneAction(taskId, "done");
        return result.success
          ? { ok: true, message: "Boa. Tirei esse retorno da sua Agenda.", undo: { label: "Desfazer", action: { kind: "server", name: "lead.reopenReturn", payload: { taskId } } } }
          : { ok: false, message: "O retorno não foi concluído. Toque de novo em alguns segundos." };
      }
      case "lead.cancelReturn": {
        const { taskId, leadName } = taskPayload.parse(payload);
        const result = await setLeadTaskDoneAction(taskId, "cancel");
        return result.success
          ? { ok: true, message: `Cancelei o retorno${leadName ? ` de ${leadName}` : ""}.`, undo: { label: "Desfazer", action: { kind: "server", name: "lead.reopenReturn", payload: { taskId } } } }
          : { ok: false, message: "O retorno não foi cancelado. Arraste de novo em alguns segundos." };
      }
      case "lead.reopenReturn": {
        const { taskId } = taskPayload.parse(payload);
        const result = await setLeadTaskDoneAction(taskId, "reopen");
        return result.success ? { ok: true, message: "Pronto, o retorno voltou para a sua Agenda." } : { ok: false, message: "Não consegui desfazer. Toque de novo em alguns segundos." };
      }
      case "lead.undoReturn": {
        const { taskId, reopenTaskId } = z.object({ taskId: z.string().uuid(), reopenTaskId: z.string().uuid().optional() }).parse(payload);
        const removed = await setLeadTaskDoneAction(taskId, "cancel");
        if (!removed.success) return { ok: false, message: "Não consegui desfazer. Toque de novo em alguns segundos." };
        if (reopenTaskId) {
          const reopened = await setLeadTaskDoneAction(reopenTaskId, "reopen");
          if (!reopened.success) return { ok: true, warning: true, message: "Tirei o retorno novo, mas o anterior não voltou. Confira na Agenda." };
        }
        return { ok: true, message: reopenTaskId ? "Desfeito. O retorno voltou para o horário de antes." : "Desfeito. Tirei esse retorno da Agenda." };
      }
      case "lead.restoreStep": {
        const { leadId, status } = leadPayload.extend({ status: z.enum(RESTORABLE_STEPS) }).parse(payload);
        const result = await changeLeadStatusAction({}, form({ leadId, newStatus: status }));
        return result.success ? { ok: true, message: "Desfeito. A etapa voltou a ser a de antes." } : { ok: false, message: "Não consegui desfazer. Toque de novo em alguns segundos." };
      }
      case "lead.markLost": {
        const { leadId, reason } = leadPayload.extend({ reason: z.enum(MOTIVOS_PERDA) }).parse(payload);
        const result = await changeLeadStatusAction({}, form({ leadId, newStatus: "lost", motivoPerda: reason }));
        return result.success
          ? { ok: true, message: "Registrei. O atendimento foi encerrado e conta no seu histórico." }
          : { ok: false, message: "O atendimento não foi encerrado. Toque de novo em alguns segundos." };
      }
      case "lead.addNote": {
        const { leadId, content, clientMessageId } = leadPayload.extend({ content: z.string().trim().min(1).max(2000), clientMessageId: clientMessageIdSchema.optional() }).parse(payload);
        const result = await addLeadNoteAction({}, form({ leadId, content, ...(clientMessageId ? { clientMessageId } : {}) }));
        return result.success ? { ok: true, message: "Anotei no histórico do lead." } : { ok: false, message: "A nota não foi salva. Toque de novo em alguns segundos." };
      }
      case "duty.pause": {
        await updateBrokerAvailabilityAction("paused");
        return { ok: true, message: "Pausei você. Para voltar a receber, abra Plantão agora e toque em \"Voltar a receber\".", undo: { label: "Desfazer", action: { kind: "server", name: "duty.resume", payload: {} } } };
      }
      case "duty.resume": {
        await updateBrokerAvailabilityAction("available");
        return { ok: true, message: "Pronto, você voltou a receber leads.", undo: { label: "Desfazer", action: { kind: "server", name: "duty.pause", payload: {} } } };
      }
      case "notifications.markRead": {
        await markAllNotificationsReadAction();
        return { ok: true, message: "Pronto, marquei todos os avisos como lidos." };
      }
      case "team.addBroker": {
        const result = await addBrokerToMyTeamAction(String(payload.brokerId ?? ""));
        return { ok: result.ok, message: result.ok ? result.message : "Não deu para adicionar o corretor agora. Tente de novo em alguns segundos." };
      }
      case "relationship.ack": {
        const result = await acknowledgeAction();
        if (!result.ok) return { ok: false, message: "Não consegui confirmar agora. Tente de novo em instantes." };
        return { ok: true, message: result.data ? "Pronto, a gestão já sabe que você está ciente." : "Não havia pedido de confirmação pendente. Nada foi alterado." };
      }
      default:
        return { ok: false, message: "Isso se faz na conversa do lead. Abra o lead para continuar." };
    }
  } catch (error) {
    console.error("[broker-chat] action failed", error);
    return { ok: false, message: "Sua ação não foi concluída. Toque de novo em alguns segundos." };
  }
}

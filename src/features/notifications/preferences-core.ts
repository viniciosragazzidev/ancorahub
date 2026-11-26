/**
 * Preferências de notificação de cada usuário (Minha conta > Notificações, 26/11/2026).
 * Os avisos do sistema (catalog.ts) ficam agrupados nos tipos que a pessoa entende; cada tipo liga ou desliga
 * por canal. O aviso no app (sino) continua sempre: a preferência decide só o push e o WhatsApp interno.
 * Padrão: tudo ligado, privacidade do push desligada. Módulo puro, usado no servidor e na tela.
 */
import type { NotificationCapabilityId } from "./catalog";

export type NotificationChannel = "push" | "whatsapp";

export const notificationPreferenceGroups = [
  {
    id: "lead_assigned",
    label: "Lead novo atribuído",
    description: "Lead distribuído ou reatribuído para você, lead chegando na fila e lista da equipe.",
    channels: ["push", "whatsapp"],
    capabilities: ["lead_assignment", "lead_reassigned", "lead_arrived", "team_list_distributed"],
  },
  {
    id: "lead_message",
    label: "Mensagem nova do lead",
    description: "Cliente voltou a chamar e mensagem que pede atendimento humano.",
    channels: ["push", "whatsapp"],
    capabilities: ["lead_client_returned", "quick_reply_human"],
  },
  {
    id: "task_due",
    label: "Tarefa vencendo",
    description: "Tarefa vencida, lembrete de feedback e lead parado no prazo.",
    channels: ["push"],
    capabilities: ["task_overdue", "lead_feedback_reminder", "lead_feedback_overdue", "lead_sla"],
  },
  {
    id: "proposal_outcome",
    label: "Proposta e documentos",
    description: "Proposta ou documento aprovado ou recusado, fechamento, venda, lead perdido ou reaberto.",
    channels: ["push", "whatsapp"],
    capabilities: ["proposal_approved", "proposal_rejected", "document_reviewed", "lead_closing_stage", "lead_closing_outcome", "lead_converted", "sale_registered", "lead_lost", "lead_reopened"],
  },
  {
    id: "team_notice",
    label: "Aviso da equipe",
    description: "Recados da direção, nota da gestão, plantão, convites e resumos da equipe.",
    channels: ["push"],
    capabilities: [
      "relationship_message", "manager_note", "duty_assignment", "duty_absence", "duty_skip_pause", "duty_presence_photo",
      "supervisor_digest", "team_weekly_summary", "journey_near_completion", "supervisor_transfer", "broker_unit_change",
      "supervisor_team_invite", "ai_budget",
    ],
  },
  {
    id: "lead_activity",
    label: "Andamento dos leads",
    description: "Atendimento iniciado, sinais da IA na conversa, renovação e reengajamento.",
    channels: ["push"],
    capabilities: ["lead_service_started", "lead_ai_insight", "client_renewal", "lead_reengagement", "lead_archived"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  channels: readonly NotificationChannel[];
  capabilities: readonly NotificationCapabilityId[];
}>;

export type NotificationPreferenceGroupId = (typeof notificationPreferenceGroups)[number]["id"];

export type NotificationPreferences = {
  channels: Record<NotificationPreferenceGroupId, Record<NotificationChannel, boolean>>;
  pushPrivacy: boolean;
};

export function defaultNotificationPreferences(): NotificationPreferences {
  const channels = {} as NotificationPreferences["channels"];
  for (const group of notificationPreferenceGroups) channels[group.id] = { push: true, whatsapp: true };
  return { channels, pushPrivacy: false };
}

const groupByCapability = new Map<string, NotificationPreferenceGroupId>(
  notificationPreferenceGroups.flatMap((group) => group.capabilities.map((capability) => [capability, group.id] as const)),
);

export function notificationGroupFor(capability: NotificationCapabilityId | null | undefined): NotificationPreferenceGroupId | null {
  return capability ? groupByCapability.get(capability) ?? null : null;
}

/** Lê o que veio do banco (jsonb parcial ou de versão antiga): o que faltar fica no padrão, ligado. */
export function normalizeNotificationPreferences(raw: { channels?: unknown; pushPrivacy?: unknown } | null | undefined): NotificationPreferences {
  const prefs = defaultNotificationPreferences();
  if (!raw) return prefs;
  const stored = raw.channels && typeof raw.channels === "object" ? (raw.channels as Record<string, unknown>) : {};
  for (const group of notificationPreferenceGroups) {
    const entry = stored[group.id];
    if (!entry || typeof entry !== "object") continue;
    for (const channel of ["push", "whatsapp"] as const) {
      const value = (entry as Record<string, unknown>)[channel];
      if (typeof value === "boolean") prefs.channels[group.id][channel] = value;
    }
  }
  prefs.pushPrivacy = raw.pushPrivacy === true;
  return prefs;
}

/**
 * O envio deve sair? Sem tipo conhecido (aviso novo ainda fora do catálogo) sai sempre, como antes.
 * Canal que o tipo não oferece também sai: a pessoa não teria como desligar.
 */
export function shouldDeliverNotification(
  prefs: NotificationPreferences | null | undefined,
  capability: NotificationCapabilityId | null | undefined,
  channel: NotificationChannel,
): boolean {
  if (!prefs) return true;
  const groupId = notificationGroupFor(capability);
  if (!groupId) return true;
  const group = notificationPreferenceGroups.find((item) => item.id === groupId);
  if (!group || !(group.channels as readonly NotificationChannel[]).includes(channel)) return true;
  return prefs.channels[groupId]?.[channel] !== false;
}

const PRIVATE_TEXT_BY_CAPABILITY: Partial<Record<NotificationCapabilityId, string>> = {
  lead_assignment: "Lead novo atribuído a você",
  team_list_distributed: "Lead novo atribuído a você",
  lead_arrived: "Lead novo na fila",
  lead_reassigned: "Um lead seu foi reatribuído",
  proposal_approved: "Uma proposta sua foi aprovada",
  proposal_rejected: "Uma proposta sua foi recusada",
};

const PRIVATE_TEXT_BY_GROUP: Record<NotificationPreferenceGroupId, string> = {
  lead_assigned: "Lead novo atribuído a você",
  lead_message: "Mensagem nova de um lead",
  task_due: "Você tem uma tarefa vencendo",
  proposal_outcome: "Atualização em uma proposta",
  team_notice: "Aviso novo da equipe",
  lead_activity: "Atualização em um lead",
};

export const PRIVATE_PUSH_TITLE = "AncoraHub";
export const PRIVATE_PUSH_FALLBACK = "Você tem um aviso novo";

/** Texto que vai no celular com a privacidade ligada: sem nome, telefone ou qualquer dado do lead. */
export function privatePushText(capability: NotificationCapabilityId | null | undefined): string {
  if (capability && PRIVATE_TEXT_BY_CAPABILITY[capability]) return PRIVATE_TEXT_BY_CAPABILITY[capability]!;
  const groupId = notificationGroupFor(capability);
  return groupId ? PRIVATE_TEXT_BY_GROUP[groupId] : PRIVATE_PUSH_FALLBACK;
}

/** Com a privacidade ligada troca título e texto do push pelo genérico do tipo; desligada, devolve como veio. */
export function applyPushPrivacy<T extends { title: string; body: string }>(
  payload: T,
  prefs: NotificationPreferences | null | undefined,
  capability: NotificationCapabilityId | null | undefined,
): T {
  if (!prefs?.pushPrivacy) return payload;
  return { ...payload, title: PRIVATE_PUSH_TITLE, body: privatePushText(capability) };
}

/**
 * Team notices (DEC-125): the automatic WhatsApp messages sent to team
 * members. Pure data, no I/O. Each notice has a class that decides which
 * delivery limits apply:
 * - critical: new lead and lead information. No limits and no business
 *   hours (a Saturday plantão still gets its offers); only the company
 *   number's short spacing applies.
 * - informative: sent Mon–Fri 08:00–18:00, within per-person limits.
 * - reminder: informative rules plus at most 2 per person per day.
 */
export type NoticeClass = "critical" | "informative" | "reminder";
export type NoticeChannel = "company_number" | "meta";

export type TeamNotice = {
  key: string;
  purpose: string;
  label: string;
  description: string;
  class: NoticeClass;
  defaultEnabled: boolean;
  /** Only the Meta template works (button or secret link); channel and switch are locked. */
  metaOnly?: boolean;
};

export const TEAM_NOTICES: readonly TeamNotice[] = [
  {
    key: "LEAD_OFFER",
    purpose: "newLeadAssignment",
    label: "Novo lead disponível",
    description: "Oferta de lead para o corretor aceitar. O aceite usa o botão do template Meta.",
    class: "critical",
    defaultEnabled: true,
    metaOnly: true,
  },
  {
    key: "LEAD_ASSIGNMENT",
    purpose: "brokerLeadNotification",
    label: "Lead atribuído",
    description: "Avisa o corretor quando um lead é atribuído a ele.",
    class: "critical",
    defaultEnabled: true,
  },
  {
    key: "LEAD_ASSIGNMENT_CONFIRMED",
    purpose: "leadAssignmentConfirmed",
    label: "Informações do lead",
    description: "Depois do aceite: telefone, interesse, tipo, dependentes e cidade do lead.",
    class: "critical",
    defaultEnabled: true,
  },
  {
    key: "LEAD_ASSIGNMENT_UNAVAILABLE",
    purpose: "leadAssignmentUnavailable",
    label: "Lead indisponível",
    description: "Resposta quando o corretor tenta aceitar um lead que já foi para outra pessoa.",
    class: "informative",
    defaultEnabled: true,
  },
  {
    key: "LEAD_ASSIGNMENT_EXPIRED",
    purpose: "leadAssignmentExpired",
    label: "Oferta expirada",
    description: "Avisa que o prazo de aceite de uma oferta acabou.",
    class: "informative",
    defaultEnabled: false,
  },
  {
    key: "LEAD_FEEDBACK_REMINDER",
    purpose: "leadFeedbackReminder",
    label: "Lembrete de feedback",
    description: "Pede o registro do atendimento de um lead. No máximo 2 por pessoa por dia.",
    class: "reminder",
    defaultEnabled: false,
  },
  {
    key: "TASK_REMINDER",
    purpose: "taskReminder",
    label: "Lembrete de tarefa",
    description: "Lembra uma tarefa comercial agendada. No máximo 2 por pessoa por dia.",
    class: "reminder",
    defaultEnabled: false,
  },
  {
    key: "BROKER_ACCOUNT_ACTIVATED",
    purpose: "brokerAccountActivated",
    label: "Conta ativada",
    description: "Confirma o acesso ao CRM depois do primeiro acesso. Acontece uma vez por pessoa.",
    class: "critical",
    defaultEnabled: true,
  },
  {
    key: "BROKER_WELCOME",
    purpose: "brokerInvitation",
    label: "Convite de primeiro acesso",
    description: "Link seguro de primeiro acesso. Sai sempre pela Meta.",
    class: "critical",
    defaultEnabled: true,
    metaOnly: true,
  },
  {
    key: "DUTY_PRESENCE_CONFIRMATION",
    purpose: "dutyPresenceConfirmation",
    label: "Confirmação de presença no plantão",
    description: "Link seguro para confirmar o plantão. Sai sempre pela Meta.",
    class: "critical",
    defaultEnabled: true,
    metaOnly: true,
  },
];

const byPurpose = new Map(TEAM_NOTICES.map((notice) => [notice.purpose, notice]));
const byKey = new Map(TEAM_NOTICES.map((notice) => [notice.key, notice]));

export function teamNoticeForPurpose(purpose: string) {
  return byPurpose.get(purpose) ?? null;
}

export function teamNoticeByKey(key: string) {
  return byKey.get(key) ?? null;
}

export type TeamNoticeSetting = { enabled: boolean; channel: NoticeChannel; freeMessageId: string | null };

/** Stored setting, or the default: on/off from the catalog, company number first. */
export function effectiveNoticeSetting(notice: TeamNotice, stored: Partial<TeamNoticeSetting> | null | undefined): TeamNoticeSetting {
  if (notice.metaOnly) return { enabled: true, channel: "meta", freeMessageId: null };
  return {
    enabled: stored?.enabled ?? notice.defaultEnabled,
    channel: stored?.channel ?? "company_number",
    freeMessageId: stored?.freeMessageId ?? null,
  };
}

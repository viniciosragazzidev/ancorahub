import "server-only";

export const META_WHATSAPP_TEMPLATE_PURPOSES = {
  brokerInvitation: { name: "broker_first_access", language: "pt_BR" },
  taskReminder: { name: "ancora_lembrete_tarefa", language: "pt_BR" },
  clientNotice: { name: "ancora_aviso_cliente", language: "pt_BR" },
  newLeadAssignment: { name: "novo_lead_", language: "pt_BR" },
  leadAssignmentConfirmed: { name: "lead_assignment_confirmed", language: "pt_BR" },
  leadAssignmentUnavailable: { name: "lead_assignment_unavailable", language: "pt_BR" },
  leadAssignmentExpired: { name: "lead_assignment_expired", language: "pt_BR" },
  aiQualification: { name: "__text__", language: "pt_BR" },
} as const;

export type MetaWhatsAppTemplatePurpose = keyof typeof META_WHATSAPP_TEMPLATE_PURPOSES;

export function getMetaWhatsAppTemplate(purpose: string) {
  if (!(purpose in META_WHATSAPP_TEMPLATE_PURPOSES)) return null;
  return META_WHATSAPP_TEMPLATE_PURPOSES[purpose as MetaWhatsAppTemplatePurpose];
}

/**
 * Named variables must carry `parameter_name` in the Cloud API payload. The
 * broker invitation template is configured with {{nome}}, {{empresa}} and
 * {{cargo}}, rather than positional {{1}}, {{2}} and {{3}} placeholders.
 */
export function getMetaWhatsAppTemplateVariableNames(_purpose: string) {
  return undefined;
}

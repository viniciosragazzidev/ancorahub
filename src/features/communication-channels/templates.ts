import "server-only";

export const META_WHATSAPP_TEMPLATE_PURPOSES = {
  brokerInvitation: { name: "broker_first_access", language: "pt_BR" },
  taskReminder: { name: "corretop_lembrete_tarefa", language: "pt_BR" },
  clientNotice: { name: "corretop_aviso_cliente", language: "pt_BR" },
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
 * The approved `broker_first_access` template has a static body and a dynamic
 * URL button only. Never send body parameters for it: Meta rejects unexpected
 * parameters with Graph API error 100.
 */
export function getMetaWhatsAppTemplateVariables(purpose: string, variables: string[]) {
  return purpose === "brokerInvitation" ? [] : variables;
}

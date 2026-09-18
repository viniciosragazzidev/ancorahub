import "server-only";

import {
  CANONICAL_BROKER_INVITATION_TEMPLATE_LANGUAGE,
  CANONICAL_BROKER_INVITATION_TEMPLATE_NAME,
  CANONICAL_BROKER_LEAD_TEMPLATE_NAME,
} from "./broker-lead-template-contract";

export const META_WHATSAPP_TEMPLATE_PURPOSES = {
  brokerInvitation: {
    name: CANONICAL_BROKER_INVITATION_TEMPLATE_NAME,
    language: CANONICAL_BROKER_INVITATION_TEMPLATE_LANGUAGE,
  },
  taskReminder: { name: "ancora_lembrete_tarefa", language: "pt_BR" },
  clientNotice: { name: "ancora_aviso_cliente", language: "pt_BR" },
  brokerLeadNotification: { name: CANONICAL_BROKER_LEAD_TEMPLATE_NAME, language: "pt_BR" },
  leadQualification: { name: "lead_qualification_start", language: "pt_BR" },
  lead_qualification: { name: "lead_qualification_start", language: "pt_BR" },
  // The offer and the confirmed assignment use the same Meta-approved
  // template. Keeping two different names here made pending offers resolve to
  // the retired `novo_lead_` template and fail before reaching Meta.
  newLeadAssignment: { name: CANONICAL_BROKER_LEAD_TEMPLATE_NAME, language: "pt_BR" },
  leadAssignmentConfirmed: { name: "lead_assignment_confirmed", language: "pt_BR" },
  leadAssignmentUnavailable: { name: "lead_assignment_unavailable", language: "pt_BR" },
  leadAssignmentExpired: { name: "lead_assignment_expired", language: "pt_BR" },
  leadFeedbackReminder: { name: "registrar_feedback_lead", language: "pt_BR" },
  aiQualification: { name: "__text__", language: "pt_BR" },
} as const;

export type MetaWhatsAppTemplatePurpose = keyof typeof META_WHATSAPP_TEMPLATE_PURPOSES;

/**
 * Assignment and lifecycle notices are part of the official Meta channel.
 * They must never be redirected to a tenant WAHA number, even when an older
 * internal-notification policy still has a WAHA fallback configured.
 */
const META_ONLY_INTERNAL_PURPOSES = new Set([
  "brokerInvitation",
  "brokerLeadNotification",
  "newLeadAssignment",
  "leadAssignmentConfirmed",
  "leadAssignmentUnavailable",
  "leadAssignmentExpired",
  "leadFeedbackReminder",
]);

export function isMetaOnlyOutboundPurpose(purpose?: string) {
  return Boolean(purpose && META_ONLY_INTERNAL_PURPOSES.has(purpose));
}

export function getMetaWhatsAppTemplate(purpose: string) {
  if (!(purpose in META_WHATSAPP_TEMPLATE_PURPOSES)) return null;
  return META_WHATSAPP_TEMPLATE_PURPOSES[purpose as MetaWhatsAppTemplatePurpose];
}

/**
 * Named variables must carry `parameter_name` in the Cloud API payload. The
 * broker invitation template is configured with {{nome}}, {{empresa}} and
 * {{cargo}} and {{unidade}}, rather than positional placeholders.
 */
export function getMetaWhatsAppTemplateVariableNames(purpose: string) {
  if (purpose === "brokerInvitation") return ["nome", "empresa", "cargo", "unidade"];
  if (purpose === "brokerLeadNotification" || purpose === "newLeadAssignment") {
    return ["cargo", "corretor_nome", "lead_nome", "produto_interesse"];
  }
  if (purpose === "leadAssignmentConfirmed") {
    return ["nome_corretor", "nome_cliente", "telefone_cliente", "interesse", "tipo", "n_dependentes"];
  }
  return undefined;
}

export function buildLeadAssignmentConfirmedVariables(input: {
  corretorNome: string;
  clienteNome: string;
  clienteTelefone: string;
  interesse: string;
  tipo: string;
  dependentes: string;
  cidade: string;
  leadId: string;
}) {
  return [
    input.corretorNome,
    input.clienteNome,
    input.clienteTelefone,
    input.interesse,
    input.tipo,
    input.dependentes,
    input.cidade,
    input.leadId,
  ];
}

export function buildLeadOfferVariables(input: {
  cargo: string;
  corretorNome: string;
  leadNome: string;
  produtoInteresse: string;
  leadId: string;
}) {
  return [
    input.cargo,
    input.corretorNome,
    input.leadNome,
    input.produtoInteresse,
    input.leadId,
  ];
}

/**
 * The lead id is stored with the durable outbound message exclusively for the
 * dynamic URL button. It is not a body parameter.
 */
export function splitMetaWhatsAppTemplateVariables(purpose: string, variables: string[]) {
  if (purpose === "brokerLeadNotification" || purpose === "newLeadAssignment") {
    const [cargo, corretorNome, leadNome, produtoInteresse, leadId] = variables;
    return {
      bodyVariables: [
        cargo?.trim() || "Corretor(a)",
        corretorNome?.trim() || "Corretor(a)",
        leadNome?.trim() || "Cliente",
        produtoInteresse?.trim() || "Plano de saúde",
      ],
      urlButtonParameter: leadId || undefined,
    };
  }

  if (purpose === "leadAssignmentConfirmed") {
    const [brokerName, leadNome, leadTelefone, interesse, leadTypeLabel, dependentes, cidade, leadId] = variables;
    return {
      bodyVariables: [
        brokerName?.trim() || "Corretor(a)",
        leadNome?.trim() || "Cliente",
        leadTelefone?.trim() || "Sem telefone",
        interesse?.trim() || "Plano de saúde",
        leadTypeLabel?.trim() || "Individual",
        dependentes?.trim() || "0",
        cidade?.trim() || "Não informada",
      ],
      urlButtonParameter: leadId || undefined,
    };
  }

  return { bodyVariables: variables, urlButtonParameter: undefined };
}

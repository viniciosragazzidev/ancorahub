import "server-only";

export const META_WHATSAPP_TEMPLATE_PURPOSES = {
  brokerInvitation: { name: "broker_first_access", language: "pt_BR" },
  taskReminder: { name: "ancora_lembrete_tarefa", language: "pt_BR" },
  clientNotice: { name: "ancora_aviso_cliente", language: "pt_BR" },
  brokerLeadNotification: { name: "new_lead_broker", language: "pt_BR" },
  leadQualification: { name: "lead_qualification_start", language: "pt_BR" },
  lead_qualification: { name: "lead_qualification_start", language: "pt_BR" },
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
export function getMetaWhatsAppTemplateVariableNames(purpose: string) {
  if (purpose === "brokerInvitation") return ["nome", "empresa", "cargo"];
  if (purpose === "brokerLeadNotification") {
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
  leadId: string;
}) {
  return [
    input.corretorNome,
    input.clienteNome,
    input.clienteTelefone,
    input.interesse,
    input.tipo,
    input.dependentes,
    input.leadId,
  ];
}

/**
 * The lead id is stored with the durable outbound message exclusively for the
 * dynamic URL button. It is not a body parameter.
 */
export function splitMetaWhatsAppTemplateVariables(purpose: string, variables: string[]) {
  if (purpose === "brokerLeadNotification") {
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
    const [brokerName, leadNome, leadTelefone, interesse, leadTypeLabel, dependentes, leadId] = variables;
    return {
      bodyVariables: [
        brokerName?.trim() || "Corretor(a)",
        leadNome?.trim() || "Cliente",
        leadTelefone?.trim() || "Sem telefone",
        interesse?.trim() || "Plano de saúde",
        leadTypeLabel?.trim() || "Individual",
        dependentes?.trim() || "0",
      ],
      urlButtonParameter: leadId || undefined,
    };
  }

  if (purpose === "newLeadAssignment") {
    const [brokerName, companyName, leadTypeLabel, branchName, timeoutMinutes, leadId] = variables;
    return {
      bodyVariables: [brokerName ?? "", companyName ?? "", leadTypeLabel ?? "", branchName ?? "", timeoutMinutes ?? ""],
      urlButtonParameter: leadId,
    };
  }

  return { bodyVariables: variables, urlButtonParameter: undefined };
}

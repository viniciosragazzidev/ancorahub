import { describe, expect, it } from "vitest";

import { buildLeadAssignmentConfirmedVariables, buildLeadOfferVariables, getMetaWhatsAppTemplate, getMetaWhatsAppTemplateVariableNames, splitMetaWhatsAppTemplateVariables } from "./templates";
import {
  CANONICAL_BROKER_INVITATION_TEMPLATE_LANGUAGE,
  CANONICAL_BROKER_INVITATION_TEMPLATE_NAME,
  CANONICAL_BROKER_LEAD_TEMPLATE_NAME,
  isBrokerLeadEventKey,
  isBrokerLeadTemplatePurpose,
  isCanonicalBrokerLeadTemplateName,
} from "./broker-lead-template-contract";

describe("approved Meta WhatsApp templates", () => {
  it("keeps offer and assignment situations on one canonical contract", () => {
    expect(CANONICAL_BROKER_LEAD_TEMPLATE_NAME).toBe("new_lead_broker");
    expect(isBrokerLeadEventKey("LEAD_OFFER")).toBe(true);
    expect(isBrokerLeadEventKey("LEAD_ASSIGNMENT")).toBe(true);
    expect(isBrokerLeadTemplatePurpose("newLeadAssignment")).toBe(true);
    expect(isBrokerLeadTemplatePurpose("brokerLeadNotification")).toBe(true);
    expect(isCanonicalBrokerLeadTemplateName("new_lead_broker")).toBe(true);
    expect(isCanonicalBrokerLeadTemplateName("lead_first_contact")).toBe(false);
  });

  it("uses the approved new-lead template for broker offers", () => {
    expect(getMetaWhatsAppTemplate("newLeadAssignment")).toEqual({ name: "new_lead_broker", language: "pt_BR" });
    expect(getMetaWhatsAppTemplateVariableNames("newLeadAssignment")).toEqual([
      "cargo", "corretor_nome", "lead_nome", "produto_interesse",
    ]);
  });

  it("maps the named body variables configured for the broker invitation template", () => {
    expect(getMetaWhatsAppTemplate("brokerInvitation")).toEqual({
      name: CANONICAL_BROKER_INVITATION_TEMPLATE_NAME,
      language: CANONICAL_BROKER_INVITATION_TEMPLATE_LANGUAGE,
    });
    expect(getMetaWhatsAppTemplateVariableNames("brokerInvitation")).toEqual(["nome", "empresa", "cargo", "unidade"]);
  });

  it("uses the approved notification template and names its body variables", () => {
    expect(getMetaWhatsAppTemplate("brokerLeadNotification")).toEqual({ name: "new_lead_broker", language: "pt_BR" });
    expect(getMetaWhatsAppTemplateVariableNames("brokerLeadNotification")).toEqual(["cargo", "corretor_nome", "lead_nome", "produto_interesse"]);
  });

  it("keeps the lead qualification template distinct from the broker notification", () => {
    expect(getMetaWhatsAppTemplate("leadQualification")).toEqual({ name: "lead_qualification_start", language: "pt_BR" });
    expect(getMetaWhatsAppTemplateVariableNames("leadQualification")).toBeUndefined();
  });

  it("uses the same named contract for a pending offer and a confirmed assignment", () => {
    const variables = buildLeadOfferVariables({
      cargo: "Corretor(a)",
      corretorNome: "Edvania",
      leadNome: "Seu Romário",
      produtoInteresse: "Plano Familiar",
      leadId: "lead-id",
    });

    expect(variables).toEqual([
      "Corretor(a)", "Edvania", "Seu Romário", "Plano Familiar", "lead-id",
    ]);
    expect(splitMetaWhatsAppTemplateVariables("newLeadAssignment", variables)).toEqual({
      bodyVariables: ["Corretor(a)", "Edvania", "Seu Romário", "Plano Familiar"],
      urlButtonParameter: "lead-id",
    });
  });

  it("reserves the fifth stored value for the new-lead button, not the body", () => {
    expect(splitMetaWhatsAppTemplateVariables("brokerLeadNotification", ["Corretor(a)", "André", "Maria", "Plano Familiar", "lead-id"])).toEqual({
      bodyVariables: ["Corretor(a)", "André", "Maria", "Plano Familiar"],
      urlButtonParameter: "lead-id",
    });
  });

  it("uses the approved accepted-offer contract, including the seventh URL value", () => {
    const variables = buildLeadAssignmentConfirmedVariables({
      corretorNome: "André",
      clienteNome: "Maria",
      clienteTelefone: "5511999999999",
      interesse: "Plano familiar",
      tipo: "Pessoa Física",
      dependentes: "2",
      cidade: "Nova Iguaçu",
      leadId: "lead-id",
    });

    expect(getMetaWhatsAppTemplateVariableNames("leadAssignmentConfirmed")).toEqual([
      "nome_corretor", "nome_cliente", "telefone_cliente", "interesse", "tipo", "n_dependentes",
    ]);
    expect(splitMetaWhatsAppTemplateVariables("leadAssignmentConfirmed", variables)).toEqual({
      bodyVariables: ["André", "Maria", "5511999999999", "Plano familiar", "Pessoa Física", "2", "Nova Iguaçu"],
      urlButtonParameter: "lead-id",
    });
  });
});

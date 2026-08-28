import { describe, expect, it } from "vitest";

import { buildLeadAssignmentConfirmedVariables, getMetaWhatsAppTemplate, getMetaWhatsAppTemplateVariableNames, splitMetaWhatsAppTemplateVariables } from "./templates";

describe("approved Meta WhatsApp templates", () => {
  it("uses the approved new-lead template for broker offers", () => {
    expect(getMetaWhatsAppTemplate("newLeadAssignment")).toEqual({ name: "novo_lead_", language: "pt_BR" });
  });

  it("maps the named body variables configured for the broker invitation template", () => {
    expect(getMetaWhatsAppTemplateVariableNames("brokerInvitation")).toEqual(["nome", "empresa", "cargo"]);
  });

  it("uses the approved notification template and names its body variables", () => {
    expect(getMetaWhatsAppTemplate("brokerLeadNotification")).toEqual({ name: "new_lead_broker", language: "pt_BR" });
    expect(getMetaWhatsAppTemplateVariableNames("brokerLeadNotification")).toEqual(["cargo", "corretor_nome", "lead_nome", "produto_interesse"]);
  });

  it("keeps the lead qualification template distinct from the broker notification", () => {
    expect(getMetaWhatsAppTemplate("leadQualification")).toEqual({ name: "lead_qualification_start", language: "pt_BR" });
    expect(getMetaWhatsAppTemplateVariableNames("leadQualification")).toBeUndefined();
  });

  it("keeps positional templates without named parameter metadata", () => {
    expect(getMetaWhatsAppTemplateVariableNames("newLeadAssignment")).toBeUndefined();
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
      leadId: "lead-id",
    });

    expect(getMetaWhatsAppTemplateVariableNames("leadAssignmentConfirmed")).toEqual([
      "nome_corretor", "nome_cliente", "telefone_cliente", "interesse", "tipo", "n_dependentes",
    ]);
    expect(splitMetaWhatsAppTemplateVariables("leadAssignmentConfirmed", variables)).toEqual({
      bodyVariables: ["André", "Maria", "5511999999999", "Plano familiar", "Pessoa Física", "2"],
      urlButtonParameter: "lead-id",
    });
  });
});

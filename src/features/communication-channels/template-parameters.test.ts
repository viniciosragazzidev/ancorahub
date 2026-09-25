import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { declaredNamedBodyParameters, resolveNamedTemplateBodyParameters } from "./template-parameters";

// Approved on the current sending number (WABA 2993650094309602) as of 25/09.
const leadInformations = [
  { type: "HEADER", format: "TEXT", text: "Lead aceito com sucesso!" },
  {
    type: "BODY",
    text: "Aqui estão as informações do lead atribuído a você.\n\n*Nome*: {{nome}};\n*Contato*: {{telefone}};\n*Interesse*: {{interesse}};\n*Dependentes*: {{n_dependentes}};\n*Cidade*:{{cidade}};",
    example: { body_text_named_params: [{ param_name: "nome" }, { param_name: "telefone" }, { param_name: "interesse" }, { param_name: "n_dependentes" }, { param_name: "cidade" }] },
  },
];
const leadAssignmentConfirmed = [
  {
    type: "BODY",
    text: "Olá, {{nome_corretor}}.\n*Cliente*: {{nome_cliente}}\n*Telefone*: {{telefone_cliente}}\n*Interesse*: {{interesse}}\n*Tipo*: {{tipo}}\n*Dependentes*: {{n_dependentes}}",
    example: { body_text_named_params: ["nome_corretor", "nome_cliente", "telefone_cliente", "interesse", "tipo", "n_dependentes"].map((param_name) => ({ param_name })) },
  },
];
// Stored outbox row: corretor, cliente, telefone, interesse, tipo, dependentes, cidade, leadId.
const accepted = ["Kaio lavosie 10118", "Creuza", "+5521999428504", "Plano de saúde", "PME · MEI", "Não informado", "Niterói", "lead-id"];

describe("declaredNamedBodyParameters", () => {
  it("reads named parameters in Meta's declared order", () => {
    expect(declaredNamedBodyParameters(leadInformations)).toEqual(["nome", "telefone", "interesse", "n_dependentes", "cidade"]);
  });

  it("leaves positional and parameterless bodies to the legacy contract", () => {
    expect(declaredNamedBodyParameters([{ type: "BODY", text: "Oi {{1}}, {{2}}" }])).toBeNull();
    expect(declaredNamedBodyParameters([{ type: "BODY", text: "Sem variáveis" }])).toBeNull();
    expect(declaredNamedBodyParameters([])).toBeNull();
  });
});

describe("resolveNamedTemplateBodyParameters", () => {
  it("fills the replacement template lead_informations from the same accepted-lead row, including the city", () => {
    expect(resolveNamedTemplateBodyParameters({ purpose: "leadAssignmentConfirmed", rawVariables: accepted, componentsJson: leadInformations })).toEqual({
      ok: true,
      variableNames: ["nome", "telefone", "interesse", "n_dependentes", "cidade"],
      variables: ["Creuza", "+5521999428504", "Plano de saúde", "Não informado", "Niterói"],
    });
  });

  it("still fills the original lead_assignment_confirmed contract", () => {
    expect(resolveNamedTemplateBodyParameters({ purpose: "leadAssignmentConfirmed", rawVariables: accepted, componentsJson: leadAssignmentConfirmed })).toMatchObject({
      ok: true,
      variables: ["Kaio lavosie 10118", "Creuza", "+5521999428504", "Plano de saúde", "PME · MEI", "Não informado"],
    });
  });

  it("keeps the duty presence invite exactly as it is sent today", () => {
    const presence = [{ type: "BODY", text: "Olá, *{{nome}}*! Plantão *{{hora}}h*.", example: { body_text_named_params: [{ param_name: "nome" }, { param_name: "hora" }] } }];
    expect(resolveNamedTemplateBodyParameters({ purpose: "dutyPresenceConfirmation", rawVariables: ["Felipe", "09:00", "confirmation-id"], componentsJson: presence }))
      .toEqual({ ok: true, variableNames: ["nome", "hora"], variables: ["Felipe", "09:00"] });
  });

  it("reports parameters the CRM cannot fill instead of letting Meta reject the message", () => {
    const unknown = [{ type: "BODY", text: "Oi {{nome_corretor}}, cupom {{cupom}}" }];
    expect(resolveNamedTemplateBodyParameters({ purpose: "leadAssignmentConfirmed", rawVariables: accepted, componentsJson: unknown })).toEqual({ ok: false, missing: ["cupom"] });
  });

  it("returns null for positional templates", () => {
    expect(resolveNamedTemplateBodyParameters({ purpose: "leadAssignmentConfirmed", rawVariables: accepted, componentsJson: [{ type: "BODY", text: "{{1}}" }] })).toBeNull();
  });
});

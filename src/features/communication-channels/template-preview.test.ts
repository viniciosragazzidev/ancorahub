import { describe, expect, it } from "vitest";
import { renderTemplatePreview } from "./template-preview";

describe("renderTemplatePreview", () => {
  it("renders the duty presence invite the way the broker receives it, without leaking the confirmation id", () => {
    const preview = renderTemplatePreview({
      purpose: "dutyPresenceConfirmation",
      componentsJson: [
        { type: "BODY", text: "Olá, *{{nome}}*! Você foi escalado para o plantão de hoje *{{hora}}h*. Clique no link abaixo e confirme sua presença!" },
        { type: "BUTTONS", buttons: [{ type: "URL", text: "Confirmar Presença", url: "https://crm.ancorasaude.cloud/confirm_presence?id={{1}}" }] },
      ],
      variables: ["Felipe Anjos 11441", "09:00", "3a2fe54f-dd24-4346-95d1-cae48350b292"],
      providerVariables: null,
      templateVariableNames: null,
    });
    expect(preview).toEqual({
      header: null,
      body: "Olá, *Felipe Anjos 11441*! Você foi escalado para o plantão de hoje *09:00h*. Clique no link abaixo e confirme sua presença!",
      footer: null,
      buttons: ["Confirmar Presença"],
    });
    expect(JSON.stringify(preview)).not.toContain("3a2fe54f");
  });

  it("prefers the provider variables and names the message plan actually sent", () => {
    const preview = renderTemplatePreview({
      purpose: "newLeadAssignment",
      componentsJson: [
        { type: "HEADER", format: "TEXT", text: "Um novo lead chegou!" },
        { type: "BODY", text: "Olá *{{corretor}}*, o lead {{nome_lead}} chegou e foi distribuído pra você! ⚓" },
      ],
      variables: ["Corretor(a)", "Julio Cesar 12030", "Michelle Vicente", "Pessoa Física", "lead-id"],
      providerVariables: ["Julio Cesar 12030", "Michelle Vicente"],
      templateVariableNames: ["corretor", "nome_lead"],
    });
    expect(preview?.header).toBe("Um novo lead chegou!");
    expect(preview?.body).toBe("Olá *Julio Cesar 12030*, o lead Michelle Vicente chegou e foi distribuído pra você! ⚓");
  });

  it("fills positional placeholders by index", () => {
    const preview = renderTemplatePreview({
      purpose: "taskReminder",
      componentsJson: [{ type: "BODY", text: "Oi {{1}}, tarefa: {{2}}" }, { type: "FOOTER", text: "Âncora" }],
      variables: ["Ana", "Ligar"],
    });
    expect(preview).toMatchObject({ body: "Oi Ana, tarefa: Ligar", footer: "Âncora" });
  });

  it("returns null when the template has no body to render", () => {
    expect(renderTemplatePreview({ purpose: "x", componentsJson: [], variables: [] })).toBeNull();
  });
});

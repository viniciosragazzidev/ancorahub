import { describe, expect, it } from "vitest";

import {
  buildAutomaticMetaVariableMappings,
  buildMetaProviderVariables,
  getFreeMessageUnknownVariables,
  getMessageEventByKey,
  getMessageEventByPurpose,
  renderEventFreeMessage,
} from "./message-event-catalog";

describe("message event catalog", () => {
  it("maps the real qualification and broker producers to registered events", () => {
    expect(getMessageEventByPurpose("leadQualification")?.key).toBe("FIRST_CONTACT");
    expect(getMessageEventByPurpose("brokerLeadNotification")?.key).toBe("LEAD_ASSIGNMENT");
    expect(getMessageEventByPurpose("unknown")).toBeNull();
  });

  it("renders named aliases and positional Meta placeholders with the same event contract", () => {
    const event = getMessageEventByKey("FIRST_CONTACT");
    expect(event).not.toBeNull();
    expect(renderEventFreeMessage(
      event!,
      "Olá {{nome_cliente}}, sou {{2}} da {{empresa}}.",
      ["Maria", "Luciana", "Âncora"],
    )).toBe("Olá Maria, sou Luciana da Âncora.");
  });

  it("rejects free-message variables that the selected situation cannot supply", () => {
    const event = getMessageEventByKey("LEAD_ASSIGNMENT");
    expect(event).not.toBeNull();
    expect(getFreeMessageUnknownVariables(event!, ["corretor_nome", "lead_nome", "cpf"])).toEqual(["cpf"]);
  });

  it("maps named and positional Meta variables to provider values in template order", () => {
    const event = getMessageEventByKey("LEAD_ASSIGNMENT");
    expect(event).not.toBeNull();
    const automatic = buildAutomaticMetaVariableMappings(event!, ["corretor_nome", "lead_nome", "produto_interesse"]);
    expect(automatic).toEqual({
      valid: true,
      mappings: {
        corretor_nome: "corretor_nome",
        lead_nome: "lead_nome",
        produto_interesse: "produto_interesse",
      },
    });
    expect(buildMetaProviderVariables(
      event!,
      ["Corretor", "João", "Maria", "Plano PME", "lead-1"],
      ["corretor_nome", "lead_nome", "produto_interesse"],
      automatic.mappings,
    )).toEqual(["João", "Maria", "Plano PME"]);
  });
});

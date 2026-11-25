import { describe, expect, it } from "vitest";

import { observationFromInteraction } from "./lead-observations-core";

describe("observationFromInteraction", () => {
  it("usa a observação gravada nos metadados", () => {
    expect(observationFromInteraction({ conteudo: "Status alterado: A → B.", metadata: { observation: " Cliente pediu retorno ", fromStatus: "in_contact", toStatus: "negotiation" } }))
      .toEqual({ observation: "Cliente pediu retorno", toStatus: "negotiation", stageText: null });
  });

  it("lê o texto antigo de mudança de etapa", () => {
    expect(observationFromInteraction({ conteudo: "Status alterado: Em atendimento → Em negociação. Observação: Quer plano com coparticipação", metadata: null }))
      .toEqual({ observation: "Quer plano com coparticipação", toStatus: null, stageText: "Em negociação" });
  });

  it("lê o novo contato registrado de antes dos metadados", () => {
    expect(observationFromInteraction({ conteudo: "Novo contato registrado. Como foi o contato: Atendeu e pediu a cotação", metadata: null }))
      .toEqual({ observation: "Atendeu e pediu a cotação", toStatus: "contacted", stageText: null });
  });

  it("ignora mudança de etapa sem observação", () => {
    expect(observationFromInteraction({ conteudo: "Status alterado: Novo → Em atendimento.", metadata: { fromStatus: "new", toStatus: "in_contact" } })).toBeNull();
  });
});

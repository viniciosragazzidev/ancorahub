import { describe, expect, it } from "vitest";

import { readPublicFormAnswers } from "./lead-answers";

describe("respostas do formulário na ficha do lead", () => {
  it("junta formData e formAnswers na ordem em que a pessoa respondeu", () => {
    const rows = readPublicFormAnswers(
      "formulario",
      { formAnswers: ["Para quem: Pessoa física (CPF)", "Plano atual: Não tenho um plano"] },
      { tipoPlano: "individual", idades: "30 a 39 anos", cidade: "Niterói", bairro: "Icaraí" },
    );
    expect(rows).toEqual([
      { label: "Para quem", value: "Pessoa física (CPF)" },
      { label: "Idades", value: "30 a 39 anos" },
      { label: "Cidade", value: "Niterói" },
      { label: "Bairro", value: "Icaraí" },
      { label: "Plano atual", value: "Não tenho um plano" },
    ]);
  });

  it("não vale para lead de outra origem", () => {
    expect(readPublicFormAnswers("meta_lead_ads", { formAnswers: ["Plano atual: x"] }, {})).toBeNull();
  });
});

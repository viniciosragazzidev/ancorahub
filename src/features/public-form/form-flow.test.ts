import { describe, expect, it } from "vitest";

import type { ChatBlock } from "@/components/chat/types";

import {
  applyFormChoice,
  applyFormText,
  CURRENT_PLAN_LABEL,
  FORM_STEPS,
  FORM_TOTAL_STEPS,
  formAwaiting,
  formatMobile,
  formProgress,
  nextFormBlocks,
  parseBrazilianMobile,
  parseLocality,
  parsePeopleText,
  submissionToLeadData,
  toSubmission,
  type FormAnswers,
} from "./form-flow";

function must<T>(value: T | null): T {
  if (value === null) throw new Error("expected a value");
  return value;
}
function text(answers: FormAnswers, input: string) {
  const outcome = applyFormText(answers, input);
  if ("error" in outcome) throw new Error(outcome.error);
  return outcome.answers;
}
const choices = (blocks: ChatBlock[]) => blocks.flatMap((block) => block.type === "question" ? block.choices.map((choice) => choice.label) : []);

function walkCpf() {
  let answers: FormAnswers = {};
  answers = must(applyFormChoice(answers, "kind:cpf"));
  answers = must(applyFormChoice(answers, "people:30-39"));
  answers = must(applyFormChoice(answers, "city:Niterói"));
  answers = text(answers, "Icaraí");
  answers = must(applyFormChoice(answers, "plan:tem_plano"));
  answers = text(answers, "Maria Souza");
  answers = text(answers, "(21) 99876-5432");
  return answers;
}

describe("formulário público: o fluxo", () => {
  it("tem 7 passos: CPF ou CNPJ primeiro, cidade e bairro separados, nome e WhatsApp no fim", () => {
    expect(FORM_TOTAL_STEPS).toBeLessThanOrEqual(7);
    expect(FORM_STEPS).toEqual(["kind", "people", "city", "neighborhood", "plan", "name", "phone"]);
    expect(choices(nextFormBlocks({}, 0))).toEqual(["Para mim ou minha família (CPF)", "Para minha empresa (CNPJ)"]);
  });

  it("CPF pergunta a faixa de idade; CNPJ, quantas pessoas", () => {
    expect(choices(nextFormBlocks({ kind: "cpf" }, 1))).toContain("19 a 29 anos");
    expect(choices(nextFormBlocks({ kind: "cnpj" }, 1))).toContain("3 a 9 pessoas");
  });

  it("cidade tem opções para tocar ou escrever; depois o bairro, sozinho", () => {
    const atCity: FormAnswers = { kind: "cpf", people: "30 a 39 anos" };
    expect(choices(nextFormBlocks(atCity, 2))).toContain("Niterói");
    const typed = text(atCity, "Maricá");
    expect(typed.city).toBe("Maricá");
    expect(nextFormBlocks(typed, 3)[0]).toMatchObject({ type: "assistant", text: "E em qual bairro de Maricá?" });
    expect(text(typed, "Itaipuaçu").neighborhood).toBe("Itaipuaçu");
  });

  it("pergunta do plano atual tem exatamente as duas opções pedidas", () => {
    const answers: FormAnswers = { kind: "cpf", people: "19 a 29 anos", city: "Niterói", neighborhood: "Icaraí" };
    expect(choices(nextFormBlocks(answers, 3))).toEqual([CURRENT_PLAN_LABEL.tem_plano, CURRENT_PLAN_LABEL.sem_plano]);
    expect(CURRENT_PLAN_LABEL.tem_plano).toBe("Já possuo plano, mas quero saber se estou pagando caro");
    expect(CURRENT_PLAN_LABEL.sem_plano).toBe("Não tenho um plano");
  });

  it("caminho completo: confirma o número antes de enviar e o progresso anda", () => {
    const answers = walkCpf();
    expect(formAwaiting(answers)).toBe("confirm");
    expect(nextFormBlocks(answers, 9)[0]).toMatchObject({ type: "question", prompt: "Confere o seu WhatsApp: (21) 99876-5432. Posso enviar?" });
    expect(formProgress({ kind: "cpf" })).toEqual({ title: "Suas respostas", done: 1, total: 7 });
    expect(formAwaiting(must(applyFormChoice(answers, "confirm:1")))).toBe("done");
    expect(formAwaiting(must(applyFormChoice(answers, "fixPhone:1")))).toBe("phone");
  });

  it("opção de uma pergunta já passada não muda a resposta", () => {
    const answers = walkCpf();
    expect(applyFormChoice(answers, "kind:cnpj")).toBeNull();
    expect(applyFormChoice(answers, "city:Rio de Janeiro")).toBeNull();
  });

  it("aceita idades digitadas no CPF e o número de pessoas no CNPJ", () => {
    expect(parsePeopleText("cpf", "35, 32 e 8")).toEqual({ people: "35, 32 e 8 anos", ages: [35, 32, 8], lives: 3 });
    expect(parsePeopleText("cnpj", "12")).toEqual({ people: "12 pessoas", lives: 12 });
    expect(parsePeopleText("cpf", "muitos")).toHaveProperty("error");
  });

  it("cidade e bairro precisam de letras", () => {
    expect(parseLocality("  Niterói. ", "cidade")).toEqual({ value: "Niterói" });
    expect(parseLocality("1", "bairro")).toHaveProperty("error");
  });
});

describe("formulário público: telefone", () => {
  it("aceita celular com DDD, com ou sem 55 e máscara", () => {
    expect(parseBrazilianMobile("(21) 99876-5432")).toEqual({ phone: "5521998765432" });
    expect(parseBrazilianMobile("+55 11 91234-5678")).toEqual({ phone: "5511912345678" });
    expect(parseBrazilianMobile("021 99876 5432")).toEqual({ phone: "5521998765432" });
    expect(formatMobile("5521998765432")).toBe("(21) 99876-5432");
  });

  it("recusa fixo, DDD inexistente, número curto e repetido", () => {
    expect(parseBrazilianMobile("21 3456-7890")).toHaveProperty("error");
    expect(parseBrazilianMobile("20 99876-5432")).toHaveProperty("error");
    expect(parseBrazilianMobile("99876-5432")).toHaveProperty("error");
    expect(parseBrazilianMobile("21 99999-9999")).toHaveProperty("error");
  });
});

describe("formulário público: o lead", () => {
  it("CPF vira PF com cidade, bairro e idades onde a ficha já lê", () => {
    const submission = must(toSubmission({ ...walkCpf(), confirmed: true }, "chave-123456"));
    const lead = submissionToLeadData(submission);
    expect(lead.leadType).toBe("PF");
    expect(lead.formData).toEqual({ tipoPlano: "individual", bairro: "Icaraí", cidade: "Niterói", idades: "30 a 39 anos" });
    expect(lead.formAnswers).toEqual(["Para quem: Pessoa física (CPF)", "Plano atual: Já possuo plano, mas quero saber se estou pagando caro"]);
  });

  it("CNPJ vira PME (a regra da fila PME roteia)", () => {
    const lead = submissionToLeadData({
      kind: "cnpj", name: "João", people: "3 a 9 pessoas", ages: null, lives: null, neighborhood: "Centro", city: "Rio de Janeiro",
      currentPlan: "sem_plano", phone: "5521998765432", website: "", idempotencyKey: "chave-123456",
    });
    expect(lead.leadType).toBe("PME");
    expect(lead.formData).toMatchObject({ tipoPlano: "pme", qtdVidas: "3 a 9 pessoas" });
  });
});

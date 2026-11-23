import { describe, expect, it } from "vitest";

import type { ChatBlock } from "@/components/chat/types";

import {
  applyFormChoice,
  applyFormText,
  CURRENT_PLAN_LABEL,
  FORM_TOTAL_STEPS,
  formAwaiting,
  formatMobile,
  formProgress,
  nextFormBlocks,
  parseBrazilianMobile,
  parsePeopleText,
  parsePlace,
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
  answers = text(answers, "Maria Souza");
  answers = must(applyFormChoice(answers, "people:30-39"));
  answers = text(answers, "Icaraí, Niterói");
  answers = must(applyFormChoice(answers, "plan:tem_plano"));
  answers = must(applyFormChoice(answers, "qualifier:agora"));
  answers = text(answers, "(21) 99876-5432");
  return answers;
}

describe("formulário público: o fluxo", () => {
  it("tem no máximo 7 passos e o primeiro pergunta CPF ou CNPJ", () => {
    expect(FORM_TOTAL_STEPS).toBeLessThanOrEqual(7);
    const first = nextFormBlocks({}, 0);
    expect(choices(first)).toEqual(["Para mim ou minha família (CPF)", "Para minha empresa (CNPJ)"]);
  });

  it("CPF: faixas de idade para tocar e a pergunta de quando contratar", () => {
    const named = { kind: "cpf" as const, name: "Maria Souza" };
    expect(choices(nextFormBlocks(named, 1))).toContain("19 a 29 anos");
    const atQualifier: FormAnswers = { ...named, people: "30 a 39 anos", neighborhood: "Icaraí", city: "Niterói", currentPlan: "sem_plano" };
    expect(choices(nextFormBlocks(atQualifier, 2))).toEqual(["O quanto antes", "Nos próximos 30 dias", "Só estou pesquisando"]);
  });

  it("CNPJ: quantas pessoas e se o CNPJ está ativo", () => {
    const named = { kind: "cnpj" as const, name: "João" };
    expect(choices(nextFormBlocks(named, 1))).toContain("3 a 9 pessoas");
    const atQualifier: FormAnswers = { ...named, people: "3 a 9 pessoas", neighborhood: "Centro", city: "Rio de Janeiro", currentPlan: "sem_plano" };
    expect(choices(nextFormBlocks(atQualifier, 2))).toEqual(["Sim, sou MEI", "Sim, ME, EPP ou outro", "Ainda estou abrindo"]);
  });

  it("pergunta do plano atual tem exatamente as duas opções pedidas", () => {
    const answers: FormAnswers = { kind: "cpf", name: "Maria", people: "19 a 29 anos", neighborhood: "Icaraí", city: "Niterói" };
    expect(choices(nextFormBlocks(answers, 3))).toEqual([CURRENT_PLAN_LABEL.tem_plano, CURRENT_PLAN_LABEL.sem_plano]);
    expect(CURRENT_PLAN_LABEL.tem_plano).toBe("Já possuo plano, mas quero saber se estou pagando caro");
    expect(CURRENT_PLAN_LABEL.sem_plano).toBe("Não tenho um plano");
  });

  it("caminho completo: confirma o número antes de enviar e o progresso anda", () => {
    const answers = walkCpf();
    expect(formAwaiting(answers)).toBe("confirm");
    expect(nextFormBlocks(answers, 9)[0]).toMatchObject({ type: "question", prompt: "Confere o seu WhatsApp: (21) 99876-5432. Posso enviar?" });
    expect(formProgress({ kind: "cpf" })).toEqual({ title: "Suas respostas", done: 1, total: 7 });
    const confirmed = must(applyFormChoice(answers, "confirm:1"));
    expect(formAwaiting(confirmed)).toBe("done");
    // Corrigir o número volta para a pergunta do WhatsApp.
    expect(formAwaiting(must(applyFormChoice(answers, "fixPhone:1")))).toBe("phone");
  });

  it("opção de uma pergunta já passada não muda a resposta", () => {
    const answers = walkCpf();
    expect(applyFormChoice(answers, "kind:cnpj")).toBeNull();
    expect(applyFormChoice(answers, "people:19-29")).toBeNull();
  });

  it("aceita idades digitadas no CPF e o número de pessoas no CNPJ", () => {
    expect(parsePeopleText("cpf", "35, 32 e 8")).toEqual({ people: "35, 32 e 8 anos", ages: [35, 32, 8], lives: 3 });
    expect(parsePeopleText("cnpj", "12")).toEqual({ people: "12 pessoas", lives: 12 });
    expect(parsePeopleText("cpf", "muitos")).toHaveProperty("error");
  });

  it("bairro e cidade precisam vir juntos", () => {
    expect(parsePlace("Icaraí, Niterói")).toEqual({ neighborhood: "Icaraí", city: "Niterói" });
    expect(parsePlace("Copacabana - Rio de Janeiro")).toEqual({ neighborhood: "Copacabana", city: "Rio de Janeiro" });
    expect(parsePlace("Niterói")).toHaveProperty("error");
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
    expect(lead.formAnswers).toEqual([
      "Para quem: Pessoa física (CPF)",
      "Plano atual: Já possuo plano, mas quero saber se estou pagando caro",
      "Quando você quer contratar: O quanto antes",
    ]);
  });

  it("CNPJ vira PME (a regra da fila PME roteia)", () => {
    const lead = submissionToLeadData({
      kind: "cnpj", name: "João", people: "3 a 9 pessoas", ages: null, lives: null, neighborhood: "Centro", city: "Rio de Janeiro",
      currentPlan: "sem_plano", qualifier: "mei", phone: "5521998765432", website: "", idempotencyKey: "chave-123456",
    });
    expect(lead.leadType).toBe("PME");
    expect(lead.formData).toMatchObject({ tipoPlano: "pme", qtdVidas: "3 a 9 pessoas" });
    expect(lead.formAnswers).toContain("Sua empresa tem CNPJ ativo: Sim, sou MEI");
  });
});

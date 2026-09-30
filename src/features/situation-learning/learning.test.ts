import { describe, expect, it } from "vitest";

import {
  acceptSuggestedReplies,
  acceptSuggestedReply,
  AUTO_ACTIVATE_MIN_OCCURRENCES,
  buildClusteringPrompt,
  canAutoActivate,
  coveragePercent,
  mergeSuggestionPhrases,
  parseClusteringResponse,
  scrubPersonalData,
} from "./learning";

describe("removing personal data before a question is saved", () => {
  it("removes e-mail, phone, CPF, CEP and links, keeping ages and short numbers", () => {
    expect(scrubPersonalData("meu email é maria.souza@gmail.com e meu cel (21) 98765-4321")).toBe("meu email é [e-mail] e meu cel [número]");
    expect(scrubPersonalData("cpf 123.456.789-09, cep 24020-000")).toBe("cpf [documento], cep [cep]");
    expect(scrubPersonalData("vi em https://site.com/plano?x=1")).toBe("vi em [link]");
    expect(scrubPersonalData("somos 2 pessoas de 45 anos, atendem em Niterói?")).toBe("somos 2 pessoas de 45 anos, atendem em Niterói?");
  });
});

describe("safety of a suggested reply", () => {
  it("refuses price, waiting period, discount, promise and unknown variables", () => {
    expect(acceptSuggestedReply("Custa a partir de R$ 199,90 por mês.")).toBeNull();
    expect(acceptSuggestedReply("Tem carência de 30 dias para consultas.")).toBeNull();
    expect(acceptSuggestedReply("Garantimos 20% de desconto!")).toBeNull();
    expect(acceptSuggestedReply("Oi {{cidade}}, atendemos sim.")).toBeNull();
  });

  it("keeps a short safe reply with {{nome}}, cleaning numbering and quotes", () => {
    expect(acceptSuggestedReply('1. "Atendemos Niterói sim, {{nome}}! O corretor detalha as opções na cotação."')).toBe("Atendemos Niterói sim, {{nome}}! O corretor detalha as opções na cotação.");
    expect(acceptSuggestedReplies(["Atendemos Niterói sim!", "Atendemos Niterói sim!", "R$ 10,00", "Sim, atendemos toda a região."])).toEqual(["Atendemos Niterói sim!", "Sim, atendemos toda a região."]);
  });
});

describe("grouping questions with the AI", () => {
  const known = { questionIds: ["q1", "q2", "q3", "q4"], situationKeys: ["faq.price"], suggestionIds: ["s1"] };

  it("builds a prompt with situations, open suggestions, questions and broker answers", () => {
    const prompt = buildClusteringPrompt({
      questions: [{ id: "q1", text: "atendem em Niterói?", brokerAnswer: "Atendemos sim, todo o estado do RJ." }],
      situations: [{ key: "faq.price", title: "Pergunta sobre preço", phrases: ["quanto custa?"] }],
      suggestions: [{ id: "s1", title: "Atendem em Niterói?", examples: ["vale em niteroi?"] }],
    });
    expect(prompt.user).toContain("faq.price: Pergunta sobre preço");
    expect(prompt.user).toContain("s1: Atendem em Niterói?");
    expect(prompt.user).toContain("RESPOSTA DO CORRETOR: Atendemos sim");
    expect(prompt.system).toContain("sem preços");
  });

  it("keeps only valid groups over known ids, each question once, and refuses unsafe new replies", () => {
    const raw = '```json\n{"groups":[' +
      '{"questionIds":["q1","q2"],"target":"new","title":"Atendem em Niterói?","phrases":["atendem em niteroi","tem em niteroi"],"responses":["Atendemos Niterói sim, {{nome}}!","R$ 99,00"],"action":"continue"},' +
      '{"questionIds":["q2","q3"],"target":"existing","situationKey":"faq.price"},' +
      '{"questionIds":["q4"],"target":"suggestion","suggestionId":"s9"},' +
      '{"questionIds":["q9"],"target":"new","title":"X","responses":["Resposta segura aqui."]}' +
      "]}\n```";
    expect(parseClusteringResponse(raw, known)).toEqual([
      { target: "new", questionIds: ["q1", "q2"], title: "Atendem em Niterói?", phrases: ["atendem em niteroi", "tem em niteroi"], responses: ["Atendemos Niterói sim, {{nome}}!"], action: "continue" },
      { target: "existing", questionIds: ["q3"], situationKey: "faq.price" },
    ]);
  });

  it("returns nothing for an answer that is not JSON", () => {
    expect(parseClusteringResponse("não consegui agrupar", known)).toEqual([]);
  });
});

describe("automatic activation", () => {
  const base = { enabled: true, kind: "new" as const, action: "continue" as const, occurrences: AUTO_ACTIVATE_MIN_OCCURRENCES, responses: ["Atendemos Niterói sim!"] };

  it("activates only when on, for a new situation that continues, asked enough times, with a safe reply", () => {
    expect(canAutoActivate(base)).toBe(true);
    expect(canAutoActivate({ ...base, enabled: false })).toBe(false);
    expect(canAutoActivate({ ...base, action: "transfer" })).toBe(false);
    expect(canAutoActivate({ ...base, kind: "merge" })).toBe(false);
    expect(canAutoActivate({ ...base, occurrences: AUTO_ACTIVATE_MIN_OCCURRENCES - 1 })).toBe(false);
    expect(canAutoActivate({ ...base, responses: ["Custa R$ 10,00."] })).toBe(false);
  });
});

describe("coverage and phrases", () => {
  it("computes the share of covered questions", () => {
    expect(coveragePercent({ covered: 0, total: 0 })).toBeNull();
    expect(coveragePercent({ covered: 2, total: 3 })).toBe(67);
  });

  it("merges phrases without duplicates or personal data", () => {
    expect(mergeSuggestionPhrases(["Atendem em Niterói"], ["atendem em niteroi?", "meu cel 21987654321, atende em Niterói?"])).toEqual(["Atendem em Niterói", "meu cel [número], atende em Niterói"]);
  });
});

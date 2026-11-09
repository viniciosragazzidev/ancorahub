import { describe, expect, it } from "vitest";

import { postSaleAlertIdempotencyKey, postSaleAlertMessage, postSaleAlertReasons, POST_SALE_ALERT_REASON_LABELS } from "./alert-rules";
import { autoRuleNextTurn } from "./auto-rule-scripts";
import { brokerLossCategories, classifyLossReasonText, compareLossReasons, lossReasonCheckSummary, readLossReasonCheck } from "./loss-reason-check";
import { answerChips } from "./responses-view";

const EM_DASH = String.fromCharCode(0x2014);

describe("classificador do motivo de perda", () => {
  it.each([
    ["Achei muito caro, não cabia no orçamento", "price"],
    ["o valor da mensalidade ficou alto", "price"],
    ["Já tenho plano pela empresa", "has_plan"],
    ["fechei com outra corretora", "has_plan"],
    ["Ninguém me respondeu", "not_attended"],
    ["o corretor nunca me retornou, aí fechei com outra", "not_attended"],
    ["não fui atendido", "not_attended"],
    ["a carência era muito longa", "coverage"],
    ["a rede não tinha o hospital que eu uso", "coverage"],
    ["faltou documentação do CNPJ", "coverage"],
    ["desisti por enquanto", "gave_up"],
    ["agora não é o momento", "gave_up"],
    ["perdi o interesse", "gave_up"],
    ["prefiro não dizer", "other"],
    ["", "other"],
  ] as const)("%s → %s", (text, category) => {
    expect(classifyLossReasonText(text)).toBe(category);
  });

  it("não confunde palavras parecidas (meio, cara de alguém)", () => {
    expect(classifyLossReasonText("fiquei meio em dúvida")).toBe("other");
  });

  it("lê códigos do catálogo e categorias do sistema do lado do corretor", () => {
    expect(brokerLossCategories(["preco"])).toEqual(["price"]);
    expect(brokerLossCategories(["encontrou_mais_barato"])).toEqual(["price", "has_plan"]);
    expect(brokerLossCategories(["carência"])).toEqual(["coverage"]);
    expect(brokerLossCategories(["sem_contato", "unattended_sla"])).toEqual(["not_attended"]);
    expect(brokerLossCategories(["Preço alto"])).toEqual(["price"]);
    expect(brokerLossCategories(["outro", null, "  "])).toEqual([]);
  });
});

describe("comparação R4", () => {
  it("diverge quando o cliente diz que não foi atendido e o corretor registrou preço", () => {
    const check = compareLossReasons({ clientText: "ninguém me ligou", brokerTexts: ["preco"], brokerLabel: "Preço acima do esperado" });
    expect(check.divergent).toBe(true);
    expect(check.client).toEqual({ category: "not_attended", text: "ninguém me ligou", source: "keywords" });
    expect(check.broker).toEqual({ categories: ["price"], text: "Preço acima do esperado" });
  });

  it("a categoria da IA vale sobre as palavras-chave", () => {
    expect(compareLossReasons({ clientText: "o preço", clientAiCategory: "has_plan", brokerTexts: ["preco"] })).toMatchObject({ divergent: true, client: { category: "has_plan", source: "ai" } });
    expect(compareLossReasons({ clientText: "ninguém me ligou", clientAiCategory: "price", brokerTexts: ["preco"] }).divergent).toBe(false);
    expect(compareLossReasons({ clientText: "caro", clientAiCategory: "inventada", brokerTexts: ["preco"] }).client.source).toBe("keywords");
  });

  it("não diverge com a mesma categoria, com 'outro' de qualquer lado ou sem motivo do corretor", () => {
    expect(compareLossReasons({ clientText: "achei caro", brokerTexts: ["preco"] }).divergent).toBe(false);
    expect(compareLossReasons({ clientText: "fechei com outra mais barata", brokerTexts: ["encontrou_mais_barato"] }).divergent).toBe(false);
    expect(compareLossReasons({ clientText: "prefiro não dizer", brokerTexts: ["preco"] }).divergent).toBe(false);
    expect(compareLossReasons({ clientText: "achei caro", brokerTexts: ["outro"] }).divergent).toBe(false);
    expect(compareLossReasons({ clientText: "achei caro", brokerTexts: [null, undefined] }).divergent).toBe(false);
  });

  it("resume as duas versões sem travessão", () => {
    const check = compareLossReasons({ clientText: "ninguém me ligou", brokerTexts: ["preco"], brokerLabel: "Preço acima do esperado" });
    const summary = lossReasonCheckSummary(check);
    expect(summary).toBe('Corretor: Preço (Preço acima do esperado). Cliente: Não foi atendido ou sem contato ("ninguém me ligou").');
    expect(summary).not.toContain(EM_DASH);
  });

  it("lê o resultado gravado e ignora dado inválido", () => {
    const check = compareLossReasons({ clientText: "ninguém me ligou", brokerTexts: ["preco"] });
    expect(readLossReasonCheck({ lossCheck: check })).toEqual(check);
    expect(readLossReasonCheck({ lossCheck: { client: { category: "x" }, broker: {} } })).toBeNull();
    expect(readLossReasonCheck({})).toBeNull();
  });
});

describe("alerta de motivo de perda diferente", () => {
  const divergent = { lossCheck: compareLossReasons({ clientText: "ninguém me ligou", brokerTexts: ["preco"], brokerLabel: "Preço acima do esperado" }) };

  it("entra nos motivos de alerta só quando diverge", () => {
    expect(POST_SALE_ALERT_REASON_LABELS.loss_reason_mismatch).toBe("Motivo de perda diferente do registrado");
    expect(postSaleAlertReasons({ outcome: "other", rating: null, answers: divergent })).toEqual(["loss_reason_mismatch"]);
    expect(postSaleAlertReasons({ outcome: "other", rating: null, answers: { lossCheck: compareLossReasons({ clientText: "achei caro", brokerTexts: ["preco"] }) } })).toEqual([]);
  });

  it("a notificação mostra as duas versões e é idempotente por pesquisa e motivo", () => {
    expect(postSaleAlertMessage("loss_reason_mismatch", divergent)).toBe('Motivo de perda diferente do registrado. Corretor: Preço (Preço acima do esperado). Cliente: Não foi atendido ou sem contato ("ninguém me ligou").');
    expect(postSaleAlertMessage("low_rating", divergent)).toBe(POST_SALE_ALERT_REASON_LABELS.low_rating);
    expect(postSaleAlertIdempotencyKey("s1", "loss_reason_mismatch", "u1")).toBe("post-sale-alert:s1:loss_reason_mismatch:u1");
  });

  it("mostra o chip em Quem respondeu", () => {
    expect(answerChips({ status: "completed", outcome: "other", rating: null, answers: { ...divergent, closed: "no" } }).map((chip) => chip.label)).toContain("Motivo diferente");
  });

  it("a R4 guarda a categoria da IA junto com o motivo do cliente", () => {
    const turn = autoRuleNextTurn("R4", 1, {}, { reason: "ninguém me ligou", lossCategory: "not_attended", comment: "ninguém me ligou" }, { lead: "Ana", broker: "Bia" });
    expect(turn.status).toBe("completed");
    expect(turn.answers).toMatchObject({ reason: "ninguém me ligou", lossCategory: "not_attended" });
  });
});

describe("has_plan sem falso positivo (Vigia)", () => {
  it("'já tenho interesse' e 'já fiz a cotação' não contam como já tem plano", async () => {
    const { classifyLossReasonText } = await import("./loss-reason-check");
    expect(classifyLossReasonText("já tenho interesse mas agora não")).not.toBe("has_plan");
    expect(classifyLossReasonText("já fiz a cotação")).not.toBe("has_plan");
    expect(classifyLossReasonText("já tenho plano pela empresa")).toBe("has_plan");
    expect(classifyLossReasonText("já fechei com outra corretora")).toBe("has_plan");
  });
});

import { describe, expect, it } from "vitest";

import { postSaleAlertMessage, postSaleAlertReasons } from "./alert-rules";
import { autoRuleQuestionFocus, detectAutoRuleKeywords } from "./auto-rule-scripts";
import type { AutoRuleKey } from "./auto-rules";
import { detectContactStatus, resolveContactStatus } from "./contact-status";
import { detectPostSaleKeywords } from "./conversation-rules";
import { decidePostSaleHandoff, parsePostSaleHandoffSettings, postSaleHandoffNote } from "./handoff-rules";
import { detectPostSaleIntents } from "./intents";
import { classifyR0AnswerByKeywords } from "./r0-rules";
import { renderPostSaleOpeningMessage } from "./rules";
import { POST_SALE_WAHA_OPENING_DEFAULT } from "./template-contract";
import { decidePostSaleTurn, decideR0Turn, type PolicyTurn, type PostSaleAnswersWithIntents } from "./turn-policy";

/**
 * Conversas reais da régua R1 de 24/11 (Toinha com a Cinthia, Carmen com a Viviani): a IA repetia
 * "Só para eu entender: você conseguiu falar com...?" sem parar. Agora: entende a falta de continuidade,
 * nunca repete a pergunta mais de uma vez e, com a troca ligada, passa o lead para outro corretor.
 */

const EM_DASH = String.fromCharCode(0x2014);

function talk(replies: string[], input: { rule?: AutoRuleKey | null; lead: string; broker: string; canHandoff?: boolean; seed?: string }) {
  const rule = input.rule === undefined ? "R1" : input.rule;
  let step = 0;
  let prior: PostSaleAnswersWithIntents = {};
  const turns: PolicyTurn[] = [];
  for (const text of replies) {
    const focus = rule ? autoRuleQuestionFocus(rule, step, prior) : step === 0 ? "permissão para fazer duas perguntas" : "se o corretor conseguiu falar";
    const answer = { ...(rule ? detectAutoRuleKeywords(text, focus) : detectPostSaleKeywords(text, focus)), comment: text };
    const turn = decidePostSaleTurn({ rule, step, prior, answer, reading: detectPostSaleIntents(text), text, names: { lead: input.lead, broker: input.broker, seed: input.seed ?? "survey-1", canHandoff: input.canHandoff } });
    turns.push(turn);
    step = turn.step;
    prior = turn.answers;
    if (turn.status !== "answering") break;
  }
  return turns;
}

function alertsOf(turn: PolicyTurn) {
  return postSaleAlertReasons({ outcome: turn.outcome ?? null, rating: turn.answers.rating ?? null, answers: turn.answers });
}

function expectTone(text: string) {
  expect(text).not.toContain(EM_DASH);
  expect(text).not.toMatch(/Só para eu entender: você conseguiu falar/);
  expect(text.length).toBeLessThan(200);
}

describe("leitura do contato com o corretor", () => {
  it.each([
    ["Sim, mandou mensagem mas não concluiu...", "stalled"],
    ["Ela não deu continuidade ao atendimento", "stalled"],
    ["Ela começou a enviar mensagem, e não falou mais nada há 2 dias", "stalled"],
    ["Ele parou de me responder", "stalled"],
    ["Ficou de mandar a cotação e até hoje nada", "stalled"],
    ["Visualizou e não respondeu", "stalled"],
    ["Não, ninguém me ligou", "no_contact"],
    ["Não falei com ninguém", "no_contact"],
    ["Prefiro não responder", "declined"],
    ["Sim, falei", "talked_ok"],
    ["Ela me atendeu muito bem", "talked_ok"],
    ["Qual o valor do plano?", null],
  ])("%s → %s", (text, expected) => {
    expect(detectContactStatus(text)).toBe(expected);
  });

  it("a falta de continuidade dita pelo cliente vence uma leitura da IA que não viu isso", () => {
    expect(resolveContactStatus("talked_ok", "Sim, mandou mensagem mas não concluiu")).toBe("stalled");
    expect(resolveContactStatus("other", "Ela não deu continuidade ao atendimento")).toBe("stalled");
    expect(resolveContactStatus("no_contact", "nunca falou comigo, sumiu")).toBe("no_contact");
    expect(resolveContactStatus("talked_ok", "Sim")).toBe("talked_ok");
  });
});

describe("caso Toinha (Cinthia, 24/11)", () => {
  it("troca ligada: entende a falta de continuidade e passa para outro corretor, sem repetir a pergunta", () => {
    const turns = talk(["Pode perguntar", "Sim, mandou mensagem mas não concluiu..."], { lead: "Toinha", broker: "Cinthia", canHandoff: true });
    expect(turns[0].text).toContain("Cinthia");
    expect(turns[1]).toMatchObject({ status: "completed", policy: "handoff", handoff: true, outcome: "no_contact" });
    expect(turns[1].text).toMatch(/outro corretor, que vai te chamar em seguida/);
    expect(turns[1].answers).toMatchObject({ contacted: true, contactStatus: "stalled", handoff: { status: "pending", contactStatus: "stalled", reason: "pós-venda: cliente sem continuidade do corretor Cinthia" } });
    expectTone(turns[1].text);
    expect(alertsOf(turns[1])).toEqual(["no_follow_up"]);
  });

  it("troca desligada: avisa a equipe, sem prometer outro corretor", () => {
    const turns = talk(["Pode perguntar", "Sim, mandou mensagem mas não concluiu..."], { lead: "Toinha", broker: "Cinthia", canHandoff: false });
    expect(turns[1]).toMatchObject({ status: "completed", policy: "no_follow_up", outcome: "no_contact" });
    expect(turns[1].handoff).toBeUndefined();
    expect(turns[1].answers.handoff).toBeUndefined();
    expect(turns[1].text).not.toMatch(/outro corretor/);
    expect(turns[1].text).toMatch(/equipe/);
    expectTone(turns[1].text);
  });
});

describe("caso Carmen (Viviani, 24/11)", () => {
  it("'não deu continuidade' já encerra e passa para outro corretor", () => {
    const turns = talk(["Pode perguntar", "Ela não deu continuidade ao atendimento"], { lead: "Carmen", broker: "Viviani", canHandoff: true });
    expect(turns).toHaveLength(2);
    expect(turns[1]).toMatchObject({ status: "completed", policy: "handoff" });
    expect(turns[1].answers.handoff?.reason).toBe("pós-venda: cliente sem continuidade do corretor Viviani");
  });

  it("'começou e não falou mais nada há 2 dias' também é falta de continuidade", () => {
    const turns = talk(["Pode", "Ela começou a enviar mensagem, e não falou mais nada há 2 dias"], { lead: "Carmen", broker: "Viviani", canHandoff: true });
    expect(turns[1]).toMatchObject({ status: "completed", policy: "handoff" });
  });
});

describe("nunca repete a mesma pergunta mais de uma vez", () => {
  it("resposta vaga: um esclarecimento com as opções e, na segunda vaga, encerra com educação", () => {
    const turns = talk(["Pode perguntar", "Hmm", "Não sei dizer"], { lead: "Ana", broker: "Alan" });
    expect(turns[1]).toMatchObject({ status: "answering", step: 1 });
    expect(turns[1].text).toMatch(/Alan (chegou a te atender e seguiu com você, ou parou de responder|falou com você e continuou o atendimento, ou ficou sem retorno)\?/);
    expect(turns[1].answers.questionRepeats).toBe(1);
    expect(turns[2]).toMatchObject({ status: "completed", policy: "repeat_guard", outcome: "other" });
    expectTone(turns[2].text);
  });

  it("pergunta fora do roteiro duas vezes seguidas também não vira loop", () => {
    const turns = talk(["Pode", "Tem carência?", "E cobre parto?"], { lead: "Ana", broker: "Alan" });
    expect(turns[1]).toMatchObject({ status: "answering", policy: "hold_question" });
    expect(turns[2]).toMatchObject({ status: "completed", policy: "repeat_guard" });
  });

  it("vale na pesquisa manual", () => {
    const turns = talk(["Pode perguntar", "Hmm", "Sei lá"], { rule: null, lead: "Ana", broker: "Alan" });
    expect(turns[2]).toMatchObject({ status: "completed", policy: "repeat_guard" });
  });
});

describe("pedido claro para parar vira opt-out (Carmen Lucia, 24/11)", () => {
  it.each([
    "Obrigada, não quero mais, está enviando sempre a mesma pergunta, mesmo eu dando a resposta.",
    "Para de mandar mensagem",
    "Não quero mais",
    "Não me mandem mais isso",
  ])("%s", (text) => {
    for (const canHandoff of [true, false]) {
      const turns = talk(["Pode perguntar", text], { lead: "Carmen", broker: "Viviani", canHandoff });
      expect(turns[1]).toMatchObject({ status: "opted_out" });
      expect(turns[1].handoff).toBeUndefined();
      expectTone(turns[1].text);
    }
  });

  it("também no meio da repetição e com IA que leu outra coisa", () => {
    const turns = talk(["Pode perguntar", "Hmm", "Obrigada, não quero mais, está enviando sempre a mesma pergunta, mesmo eu dando a resposta."], { lead: "Carmen", broker: "Viviani" });
    expect(turns[2]).toMatchObject({ status: "opted_out" });
    expect(turns[2].text).toMatch(/^Desculpe pelas mensagens repetidas, Carmen\. /);
    const ai = decidePostSaleTurn({ rule: "R1", step: 1, prior: { lastQuestion: "Você conseguiu falar com Viviani?" }, answer: { contacted: null, optOut: false, comment: "não quero mais" }, reading: { intents: ["gave_up"] }, text: "Obrigada, não quero mais", names: { lead: "Carmen", broker: "Viviani" } });
    expect(ai.status).toBe("opted_out");
  });

  it("'não quero mais o plano' continua desistência", () => {
    const turns = talk(["Pode", "Não quero mais o plano"], { lead: "Ana", broker: "Alan" });
    expect(turns[1].status).toBe("completed");
    expect(turns[1].policy).toBe("gave_up");
  });

  it("R0 também", () => {
    const text = "Para de me mandar mensagem";
    const turn = decideR0Turn({ answer: classifyR0AnswerByKeywords(text), reading: { intents: [] }, text, names: { lead: "Ana", broker: "Alan", canHandoff: true } });
    expect(turn.status).toBe("opted_out");
  });
});

describe("outros caminhos da R1", () => {
  it("falou e foi bem segue o roteiro normal", () => {
    const turns = talk(["Pode perguntar", "Sim, falei", "Sim"], { lead: "Ana", broker: "Alan", canHandoff: true });
    expect(turns[1]).toMatchObject({ status: "answering", step: 2 });
    expect(turns[2]).toMatchObject({ status: "completed", outcome: "ok" });
    expect(turns[2].handoff).toBeUndefined();
  });

  it("sem contato: pergunta se ainda quer ajuda; sim passa para outro corretor", () => {
    const turns = talk(["Pode", "Não, ninguém me ligou", "Sim"], { lead: "Ana", broker: "Alan", canHandoff: true });
    expect(turns[1]).toMatchObject({ status: "answering", step: 3 });
    expect(turns[2]).toMatchObject({ status: "completed", policy: "handoff", handoff: true });
    expect(turns[2].answers.handoff).toMatchObject({ contactStatus: "no_contact", reason: "pós-venda: cliente sem contato do corretor Alan" });
    expect(alertsOf(turns[2])).toEqual(["no_contact"]);
  });

  it("sem contato e não quer mais ajuda: encerra sem prometer retorno", () => {
    const turns = talk(["Pode", "Não", "Não"], { lead: "Ana", broker: "Alan", canHandoff: true });
    expect(turns[2]).toMatchObject({ status: "completed", outcome: "no_contact" });
    expect(turns[2].handoff).toBeUndefined();
    expect(turns[2].text).not.toMatch(/retomar|outro corretor/);
  });

  it("não quer responder: encerra com educação", () => {
    const turns = talk(["Pode", "Prefiro não responder"], { lead: "Ana", broker: "Alan", canHandoff: true });
    expect(turns[1]).toMatchObject({ status: "completed", policy: "declined", outcome: "other" });
  });

  it("sumiu, mas já desisti: é desistência, não troca de corretor", () => {
    const turns = talk(["Pode", "Ela sumiu, mas desisti do plano"], { lead: "Ana", broker: "Alan", canHandoff: true });
    expect(turns[1]).toMatchObject({ status: "completed", policy: "gave_up" });
  });

  it("R2: recebeu a cotação mas o corretor sumiu também passa", () => {
    const turns = talk(["Pode", "Recebi a cotação mas depois ele parou de responder"], { rule: "R2", lead: "Ana", broker: "Alan", canHandoff: true });
    expect(turns[1]).toMatchObject({ status: "completed", policy: "handoff" });
  });

  it("R3 (já cliente) não troca de corretor", () => {
    const turns = talk(["Pode", "Ele sumiu depois da venda"], { rule: "R3", lead: "Ana", broker: "Alan", canHandoff: true });
    expect(turns.every((turn) => !turn.handoff)).toBe(true);
  });

  it("o alerta da gestão conta a troca", () => {
    const turns = talk(["Pode", "Ela não deu continuidade ao atendimento"], { lead: "Carmen", broker: "Viviani", canHandoff: true });
    const done = { ...turns[1].answers, handoff: { ...turns[1].answers.handoff!, status: "done" as const } };
    expect(postSaleAlertMessage("no_follow_up", done)).toBe("Corretor não deu continuidade ao atendimento. Lead passado para outro corretor. Cliente: \"Ela não deu continuidade ao atendimento\"");
  });
});

describe("R0 (cliente voltou a escrever)", () => {
  it("'começou e parou de responder' é não atendido e passa para outro corretor", () => {
    const text = "Ele começou a falar comigo e parou de responder";
    const turn = decideR0Turn({ answer: classifyR0AnswerByKeywords(text), reading: detectPostSaleIntents(text), text, names: { lead: "Ana", broker: "Alan", canHandoff: true } });
    expect(turn).toMatchObject({ status: "completed", outcome: "r0_not_attended", awaitsTeam: true, policy: "handoff", handoff: true, contactStatus: "stalled" });
    expect(turn.text).toMatch(/outro corretor/);
  });

  it("sem troca, segue a resposta de sempre da R0", () => {
    const text = "Ninguém me respondeu";
    const turn = decideR0Turn({ answer: classifyR0AnswerByKeywords(text), reading: detectPostSaleIntents(text), text, names: { lead: "Ana", broker: "Alan", canHandoff: false } });
    expect(turn).toMatchObject({ outcome: "r0_not_attended", policy: "script" });
    expect(turn.handoff).toBeUndefined();
    expect(turn.text).not.toMatch(/outro corretor/);
  });

  it("quer cotação nova e foi atendido: não troca", () => {
    const text = "Fui atendido, queria uma nova cotação com meu marido";
    const turn = decideR0Turn({ answer: classifyR0AnswerByKeywords(text), reading: detectPostSaleIntents(text), text, names: { lead: "Ana", broker: "Alan", canHandoff: true } });
    expect(turn.handoff).toBeUndefined();
  });
});

describe("quando a troca pode acontecer", () => {
  const lead = { corretorId: "b1", status: "in_contact", deletedAt: null, archivedAt: null };
  const on = parsePostSaleHandoffSettings(JSON.stringify({ enabled: true }));

  it("desligada por padrão", () => {
    expect(parsePostSaleHandoffSettings(null)).toEqual({ enabled: false });
    expect(parsePostSaleHandoffSettings("lixo")).toEqual({ enabled: false });
    expect(decidePostSaleHandoff({ settings: { enabled: false }, surveyBrokerId: "b1", lead, ownerRole: "broker", inAutoSale: false })).toEqual({ allowed: false, skip: "disabled" });
  });

  it("ligada, com o lead ainda com o corretor avaliado e aberto", () => {
    expect(decidePostSaleHandoff({ settings: on, surveyBrokerId: "b1", lead, ownerRole: "broker", inAutoSale: false })).toEqual({ allowed: true });
  });

  it.each([
    ["lead já com outro corretor", { surveyBrokerId: "b2" }, "owner_changed"],
    ["lead vendido", { lead: { ...lead, status: "won" } }, "status"],
    ["lead em documentação", { lead: { ...lead, status: "documentation_pending" } }, "status"],
    ["lead apagado", { lead: { ...lead, deletedAt: new Date() } }, "lead_closed"],
    ["lead sem corretor", { lead: { ...lead, corretorId: null } }, "no_broker"],
    ["dono é diretor", { ownerRole: "director" }, "director_owner"],
    ["Venda Automatizada", { inAutoSale: true }, "auto_sale"],
  ])("%s não troca", (_label, patch, skip) => {
    expect(decidePostSaleHandoff({ settings: on, surveyBrokerId: "b1", lead, ownerRole: "broker", inAutoSale: false, ...patch })).toEqual({ allowed: false, skip });
  });

  it("nota do lead e aviso ao corretor antigo", () => {
    const note = postSaleHandoffNote({ leadName: "Carmen", contactStatus: "stalled" });
    expect(note.brokerMessage).toBe("Carmen: o cliente contou ao pós-venda que ficou sem continuidade do atendimento. O lead foi para outro corretor.");
    expect(note.timeline).not.toContain(EM_DASH);
  });
});

describe("abertura sem gênero", () => {
  it("não diz 'o corretor Cinthia'", () => {
    const text = renderPostSaleOpeningMessage(POST_SALE_WAHA_OPENING_DEFAULT, { nome: "Toinha", assistente: "Sasá", empresa: "Âncora", corretor: "Cinthia" });
    expect(text).toContain("e Cinthia ficou responsável pelo seu atendimento");
    expect(text).not.toMatch(/\bo Cinthia\b|corretor Cinthia/);
    expect(text).not.toMatch(/bem atendid/);
  });
});

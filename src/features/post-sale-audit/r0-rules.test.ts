import { describe, expect, it } from "vitest";

import { postSaleAlertReasons } from "./alert-rules";
import { answerChips } from "./responses-view";
import {
  classifyR0AnswerByKeywords,
  decideR0Trigger,
  isAttendanceClosingMessage,
  parseR0Settings,
  r0EscalationState,
  r0NextTurn,
  renderR0Opening,
  serializeR0Settings,
  type R0TriggerInput,
} from "./r0-rules";

const EM_DASH = String.fromCharCode(0x2014);
const now = new Date("2026-11-09T15:00:00Z"); // segunda, 12h em São Paulo

function input(overrides: Partial<R0TriggerInput> = {}): R0TriggerInput {
  return {
    settings: { enabled: true, queueIds: ["fila-pj"] },
    lead: { status: "in_contact", distributionStatus: "assigned", queueId: "fila-pj", brokerId: "broker-1", ownerRole: "broker" },
    waiting: { waitingBusinessMinutes: 12, lastCustomerMessageAt: "2026-11-09T14:45:00Z" },
    lastHumanReply: { at: new Date("2026-11-07T14:00:00Z"), body: "O que achou?" },
    now,
    withinBusinessHours: true,
    activeSurvey: false,
    optedOut: false,
    lastR0At: null,
    sourceAvailable: true,
    ...overrides,
  };
}

describe("R0 settings", () => {
  it("is off by default and on invalid values", () => {
    expect(parseR0Settings(null)).toEqual({ enabled: false, queueIds: [] });
    expect(parseR0Settings("not json")).toEqual({ enabled: false, queueIds: [] });
    expect(parseR0Settings(JSON.stringify({ enabled: "yes" }))).toEqual({ enabled: false, queueIds: [] });
  });
  it("round-trips without duplicated queues", () => {
    expect(parseR0Settings(serializeR0Settings({ enabled: true, queueIds: ["a", "a", "b"] }))).toEqual({ enabled: true, queueIds: ["a", "b"] });
  });
});

describe("decideR0Trigger", () => {
  it("fires after 10 business minutes without a human reply", () => {
    expect(decideR0Trigger(input())).toEqual({ fire: true, reason: "no_reply" });
  });

  it("the real case of 06/11: the broker closed the attendance and the client wrote again", () => {
    const decision = decideR0Trigger(input({
      lastHumanReply: { at: new Date("2026-11-09T14:40:00Z"), body: "Encerrando o atendimento" },
      waiting: { waitingBusinessMinutes: 2, lastCustomerMessageAt: "2026-11-09T14:58:00Z" },
    }));
    expect(decision).toEqual({ fire: true, reason: "after_closing" });
  });

  it("respects the switch and the pilot queues", () => {
    expect(decideR0Trigger(input({ settings: { enabled: false, queueIds: ["fila-pj"] } }))).toEqual({ fire: false, skip: "disabled" });
    expect(decideR0Trigger(input({ settings: { enabled: true, queueIds: ["outra"] } }))).toEqual({ fire: false, skip: "queue_not_in_pilot" });
  });

  it("skips leads that are not with a broker in negotiation", () => {
    expect(decideR0Trigger(input({ lead: { ...input().lead, status: "documentation_pending" } }))).toMatchObject({ skip: "status" });
    expect(decideR0Trigger(input({ lead: { ...input().lead, status: "converted" } }))).toMatchObject({ skip: "status" });
    expect(decideR0Trigger(input({ lead: { ...input().lead, distributionStatus: "offered" } }))).toMatchObject({ skip: "not_accepted" });
    expect(decideR0Trigger(input({ lead: { ...input().lead, ownerRole: "director" } }))).toMatchObject({ skip: "director_owner" });
  });

  it("applies the protections", () => {
    expect(decideR0Trigger(input({ waiting: null }))).toMatchObject({ skip: "not_waiting" });
    expect(decideR0Trigger(input({ optedOut: true }))).toMatchObject({ skip: "opted_out" });
    expect(decideR0Trigger(input({ activeSurvey: true }))).toMatchObject({ skip: "active_survey" });
    expect(decideR0Trigger(input({ lastR0At: new Date("2026-11-04T15:00:00Z") }))).toMatchObject({ skip: "cooldown" });
    expect(decideR0Trigger(input({ lastR0At: new Date("2026-11-01T15:00:00Z") }))).toEqual({ fire: true, reason: "no_reply" });
    expect(decideR0Trigger(input({ lastHumanReply: { at: new Date("2026-11-09T13:30:00Z"), body: "Já te mando" } }))).toMatchObject({ skip: "broker_recent_reply" });
    expect(decideR0Trigger(input({ waiting: { waitingBusinessMinutes: 9, lastCustomerMessageAt: "2026-11-09T14:51:00Z" } }))).toMatchObject({ skip: "too_soon" });
    expect(decideR0Trigger(input({ withinBusinessHours: false }))).toMatchObject({ skip: "outside_business_hours" });
    expect(decideR0Trigger(input({ waiting: { waitingBusinessMinutes: 300, lastCustomerMessageAt: "2026-11-08T12:00:00Z" } }))).toMatchObject({ skip: "window_closed" });
    expect(decideR0Trigger(input({ sourceAvailable: false }))).toMatchObject({ skip: "source_unavailable" });
  });
});

describe("closing message", () => {
  it("recognizes the broker closing the attendance", () => {
    expect(isAttendanceClosingMessage("Encerrando o atendimento")).toBe(true);
    expect(isAttendanceClosingMessage("Vou encerrar por aqui, qualquer coisa me chama")).toBe(true);
    expect(isAttendanceClosingMessage("Atendimento finalizado.")).toBe(true);
    expect(isAttendanceClosingMessage("O que achou da cotação?")).toBe(false);
  });
});

describe("R0 answer classification by keywords", () => {
  it("(a) not attended or no quote", () => {
    expect(classifyR0AnswerByKeywords("Não, ninguém me respondeu").category).toBe("not_attended");
    expect(classifyR0AnswerByKeywords("não recebi a cotação").category).toBe("not_attended");
    expect(classifyR0AnswerByKeywords("Não").category).toBe("not_attended");
  });
  it("(b) attended and wants something", () => {
    const answer = classifyR0AnswerByKeywords("Sim, mas quero uma cotação nova incluindo minha esposa");
    expect(answer.category).toBe("wants_more");
    expect(answer.request).toContain("cotação nova");
    expect(classifyR0AnswerByKeywords("sim").category).toBe("wants_more");
    expect(classifyR0AnswerByKeywords("Tenho uma dúvida sobre a carência").category).toBe("wants_more");
  });
  it("(c) closed elsewhere or gave up", () => {
    expect(classifyR0AnswerByKeywords("Já fechei com outra corretora")).toMatchObject({ category: "closed_or_gave_up", closedKind: "closed_elsewhere" });
    expect(classifyR0AnswerByKeywords("Desisti, ficou caro")).toMatchObject({ category: "closed_or_gave_up", closedKind: "gave_up" });
  });
  it("(d) other subject", () => {
    expect(classifyR0AnswerByKeywords("Vocês atendem em Niterói?").category).toBe("other_subject");
  });
  it("opt-out only on an explicit stop", () => {
    expect(classifyR0AnswerByKeywords("Pare de me mandar mensagem").optOut).toBe(true);
    expect(classifyR0AnswerByKeywords("Não quero mais o plano").optOut).toBe(false);
  });
});

describe("R0 destinations", () => {
  const names = { lead: "Carla" };
  it("(a) and (b) wait for the team and never mention the broker or a price", () => {
    for (const category of ["not_attended", "wants_more", "other_subject"] as const) {
      const turn = r0NextTurn({ category }, names);
      expect(turn.status).toBe("completed");
      expect(turn.awaitsTeam).toBe(true);
      expect(turn.text).not.toMatch(/corretor|R\$|valor|preço/i);
      expect(turn.text).not.toContain(EM_DASH);
    }
    expect(r0NextTurn({ category: "not_attended" }, names).outcome).toBe("r0_not_attended");
    expect(r0NextTurn({ category: "wants_more" }, names).outcome).toBe("r0_wants_more");
    expect(r0NextTurn({ category: "other_subject" }, names).outcome).toBe("r0_other");
  });
  it("(c) closes politely and does not wait for anybody", () => {
    expect(r0NextTurn({ category: "closed_or_gave_up", closedKind: "gave_up" }, names)).toMatchObject({ outcome: "r0_gave_up", awaitsTeam: false });
    expect(r0NextTurn({ category: "closed_or_gave_up", closedKind: "closed_elsewhere" }, names)).toMatchObject({ outcome: "r0_closed_elsewhere", awaitsTeam: false });
  });
  it("opt-out stops", () => {
    expect(r0NextTurn({ category: "other_subject", optOut: true }, names)).toMatchObject({ status: "opted_out", awaitsTeam: false });
  });
  it("only (a) alerts the direction right away; the escalation alerts later", () => {
    expect(postSaleAlertReasons({ outcome: "r0_not_attended", rating: null, answers: { r0: { category: "not_attended" } } })).toEqual(["not_attended"]);
    expect(postSaleAlertReasons({ outcome: "r0_wants_more", rating: null, answers: { r0: { category: "wants_more" } } })).toEqual([]);
    expect(postSaleAlertReasons({ outcome: "r0_wants_more", rating: null, answers: { r0: { category: "wants_more", escalatedAt: "2026-11-09T15:20:00Z" } } })).toEqual(["team_no_reply"]);
  });
  it("shows chips for the R0 answers", () => {
    expect(answerChips({ status: "completed", outcome: "r0_not_attended", rating: null, answers: { r0: { category: "not_attended" } } }).map((chip) => chip.label)).toEqual(["Voltou a escrever", "Não foi atendido"]);
  });
});

describe("R0 opening", () => {
  it("greets with the client and the broker first names, without em dash", () => {
    const text = renderR0Opening({ lead: "Carla", broker: "Ana", assistant: "Lia", company: "Âncora", leadType: "PJ" });
    expect(text).toContain("Oi, Carla!");
    expect(text).toContain("conversou com Ana sobre o plano empresarial");
    expect(text).toContain("você chegou a ser atendido e recebeu a cotação?");
    expect(text).not.toContain(EM_DASH);
  });
});

describe("R0 escalation", () => {
  const answeredAt = new Date("2026-11-09T15:00:00Z");
  it("resolves when a person of the company replied after the answer", () => {
    expect(r0EscalationState({ answeredAt, humanReplyAt: new Date("2026-11-09T15:05:00Z"), businessMsSinceAnswer: 20 * 60_000 })).toBe("resolved");
  });
  it("escalates after 15 business minutes without a reply", () => {
    expect(r0EscalationState({ answeredAt, humanReplyAt: null, businessMsSinceAnswer: 14 * 60_000 })).toBe("wait");
    expect(r0EscalationState({ answeredAt, humanReplyAt: new Date("2026-11-09T14:00:00Z"), businessMsSinceAnswer: 15 * 60_000 })).toBe("escalate");
  });
});

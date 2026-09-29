import { describe, expect, it } from "vitest";

import { BUILTIN_FLOWS } from "./builtin";
import { validateFlow, type FlowDefinition } from "./definition";
import { stepFlow, type RunFacts } from "./runner";

const facts: RunFacts = { now: new Date("2026-09-30T13:00:00Z"), businessHours: true, serviceWindowOpen: false, lastReply: null, leadFields: {} };

// Welcome → wait for a reply (2 h) → if the reply mentions PME go to the PME queue, else distribute; no reply → follow-up once.
const welcome: FlowDefinition = {
  nodes: [
    { id: "start", type: "start" },
    { id: "hello", type: "send_and_wait", channel: "lead_channel", messageId: "msg-hello", timeoutMinutes: 120 },
    { id: "kind", type: "condition", rules: [{ id: "pme", field: "reply_contains", value: "pme" }] },
    { id: "to_pme", type: "transfer", target: "queue", queueId: "queue-pme" },
    { id: "distribute", type: "transfer", target: "distribution" },
    { id: "nudge", type: "send_message", channel: "company_number", messageId: "msg-nudge" },
    { id: "end", type: "end" },
  ],
  edges: [
    { id: "a", source: "start", target: "hello" },
    { id: "b", source: "hello", target: "kind", handle: "replied" },
    { id: "c", source: "hello", target: "nudge", handle: "no_reply" },
    { id: "d", source: "kind", target: "to_pme", handle: "pme" },
    { id: "e", source: "kind", target: "distribute", handle: "else" },
    { id: "f", source: "to_pme", target: "end" },
    { id: "g", source: "distribute", target: "end" },
    { id: "h", source: "nudge", target: "distribute" },
  ],
};

describe("flow validation", () => {
  it("accepts the ready-made flows and a complete custom flow", () => {
    for (const flow of Object.values(BUILTIN_FLOWS)) expect(validateFlow(flow.definition)).toEqual([]);
    expect(validateFlow(welcome)).toEqual([]);
  });

  it("points at every missing exit, loose block and missing message", () => {
    const broken: FlowDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "hello", type: "send_and_wait", channel: "meta", messageId: null, timeoutMinutes: 0 },
        { id: "kind", type: "condition", rules: [{ id: "r", field: "business_hours" }] },
        { id: "lost", type: "wait", minutes: 10 },
        { id: "end", type: "end" },
      ],
      edges: [
        { id: "a", source: "start", target: "hello" },
        { id: "b", source: "hello", target: "kind", handle: "replied" },
        { id: "c", source: "kind", target: "end", handle: "r" },
        { id: "d", source: "lost", target: "end" },
      ],
    };
    const messages = validateFlow(broken).map((issue) => issue.message);
    expect(messages).toEqual(expect.arrayContaining([
      'Enviar e aguardar resposta: falta ligar a saída "sem resposta".',
      "Enviar e aguardar resposta: escolha a mensagem.",
      "Enviar e aguardar: defina o tempo de espera.",
      'Condição: falta ligar a saída "senão".',
      "Aguardar: bloco solto, nenhum caminho chega nele.",
    ]));
  });

  it("refuses a loop that never waits", () => {
    const loop: FlowDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "a", type: "update_lead", tag: "x" },
        { id: "b", type: "condition", rules: [{ id: "again", field: "business_hours" }] },
        { id: "end", type: "end" },
      ],
      edges: [
        { id: "1", source: "start", target: "a" },
        { id: "2", source: "a", target: "b" },
        { id: "3", source: "b", target: "a", handle: "again" },
        { id: "4", source: "b", target: "end", handle: "else" },
      ],
    };
    expect(validateFlow(loop).map((issue) => issue.message)).toContain("Há uma volta no fluxo sem Aguardar, resposta do lead ou agente: ela rodaria sem parar.");
  });
});

describe("flow runner", () => {
  it("runs today's intake as a single step", () => {
    const flow = BUILTIN_FLOWS.current.definition;
    const first = stepFlow(flow, null, { type: "start" }, facts);
    expect(first).toEqual({ status: "running", nodeId: "legacy", effect: { kind: "legacy_intake", nodeId: "legacy" } });
    expect(stepFlow(flow, "legacy", { type: "effect_done" }, facts)).toEqual({ status: "completed", nodeId: "end" });
  });

  it("sends, waits for the reply and branches on it", () => {
    expect(stepFlow(welcome, null, { type: "start" }, facts)).toMatchObject({ status: "running", nodeId: "hello", effect: { kind: "send", messageId: "msg-hello", awaitReply: true } });
    expect(stepFlow(welcome, "hello", { type: "effect_done" }, facts)).toEqual({ status: "waiting", nodeId: "hello", until: new Date("2026-09-30T15:00:00Z"), waitingFor: "reply" });
    expect(stepFlow(welcome, "hello", { type: "reply", text: "Quero um plano PME" }, facts)).toMatchObject({ status: "running", nodeId: "to_pme", effect: { kind: "transfer", target: "queue", queueId: "queue-pme" } });
    expect(stepFlow(welcome, "hello", { type: "reply", text: "Para minha família" }, facts)).toMatchObject({ status: "running", nodeId: "distribute", effect: { kind: "transfer", target: "distribution" } });
  });

  it("follows the no-reply exit on timeout", () => {
    expect(stepFlow(welcome, "hello", { type: "timeout" }, facts)).toMatchObject({ status: "running", nodeId: "nudge", effect: { kind: "send", channel: "company_number", awaitReply: false } });
    expect(stepFlow(welcome, "nudge", { type: "effect_done" }, facts)).toMatchObject({ status: "running", nodeId: "distribute" });
  });

  it("distributes when the agent cannot conclude and just ends when it does", () => {
    const flow = BUILTIN_FLOWS.qualify_new_engine.definition;
    expect(stepFlow(flow, null, { type: "start" }, facts)).toMatchObject({ status: "running", nodeId: "agent", effect: { kind: "start_agent", engine: "new" } });
    expect(stepFlow(flow, "agent", { type: "effect_done" }, facts)).toEqual({ status: "waiting", nodeId: "agent", until: null, waitingFor: "agent" });
    expect(stepFlow(flow, "agent", { type: "agent_result", outcome: "failed" }, facts)).toMatchObject({ status: "running", nodeId: "transfer" });
    // The engine already distributes when it concludes: the flow just ends.
    expect(stepFlow(flow, "agent", { type: "agent_result", outcome: "done" }, facts)).toEqual({ status: "completed", nodeId: "end" });
  });

  it("ignores events that do not belong to the current block", () => {
    expect(stepFlow(welcome, "hello", { type: "agent_result", outcome: "done" }, facts)).toMatchObject({ status: "waiting", nodeId: "hello" });
  });
});

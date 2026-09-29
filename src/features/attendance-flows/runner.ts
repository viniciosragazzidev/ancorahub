import type { ConditionField, FlowDefinition, FlowNode } from "./definition";

/**
 * Deterministic step of a flow run (DEC-127): given where the run is and what
 * happened, says what to do and where the run goes. Pure, no I/O. The runtime
 * performs the effects (send, agent, transfer...) and feeds the result back.
 */
export type RunEvent =
  | { type: "start" }
  | { type: "effect_done" }
  | { type: "reply"; text: string }
  | { type: "timeout" }
  | { type: "agent_result"; outcome: "done" | "failed" };

export type RunFacts = {
  now: Date;
  businessHours: boolean;
  serviceWindowOpen: boolean;
  lastReply: string | null;
  leadFields: Record<string, string | null | undefined>;
};

export type Effect =
  | { kind: "send"; nodeId: string; channel: string; messageId: string; awaitReply: boolean }
  | { kind: "start_agent"; nodeId: string; engine: string; agentId: string | null; autonomy: string }
  | { kind: "transfer"; nodeId: string; target: "distribution" | "queue"; queueId: string | null }
  | { kind: "update_lead"; nodeId: string; status: string | null; tag: string | null }
  | { kind: "legacy_intake"; nodeId: string };

export type StepResult =
  | { status: "running"; nodeId: string; effect: Effect }
  | { status: "waiting"; nodeId: string; until: Date | null; waitingFor: "reply" | "time" | "agent" }
  | { status: "completed"; nodeId: string }
  | { status: "failed"; nodeId: string | null; reason: string };

const MAX_HOPS = 50;

function edgeFrom(definition: FlowDefinition, nodeId: string, handle = "next") {
  return definition.edges.find((edge) => edge.source === nodeId && (edge.handle ?? "next") === handle) ?? null;
}

function matches(field: ConditionField, value: string | undefined, facts: RunFacts) {
  switch (field) {
    case "business_hours": return facts.businessHours;
    case "service_window_open": return facts.serviceWindowOpen;
    case "reply_contains": return Boolean(value && facts.lastReply?.toLocaleLowerCase("pt-BR").includes(value.toLocaleLowerCase("pt-BR")));
    case "lead_field_present": return Boolean(value && facts.leadFields[value]?.toString().trim());
  }
}

/**
 * Walks from `fromNodeId` following `handle`, running conditions inline,
 * until a block that needs an effect or waits. Never runs an effect twice:
 * the caller only calls this once per event.
 */
function advance(definition: FlowDefinition, fromNodeId: string, handle: string, facts: RunFacts): StepResult {
  const byId = new Map(definition.nodes.map((node) => [node.id, node]));
  let edge = edgeFrom(definition, fromNodeId, handle);
  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    if (!edge) return { status: "failed", nodeId: fromNodeId, reason: `Saída "${handle}" sem ligação.` };
    const node = byId.get(edge.target);
    if (!node) return { status: "failed", nodeId: edge.target, reason: "Bloco não encontrado." };
    const result = enter(node, facts);
    if (result.kind === "step") return result.step;
    edge = edgeFrom(definition, node.id, result.handle);
    fromNodeId = node.id;
    handle = result.handle;
  }
  return { status: "failed", nodeId: fromNodeId, reason: "O fluxo passou por blocos demais sem parar." };
}

type Entered = { kind: "step"; step: StepResult } | { kind: "follow"; handle: string };

function enter(node: FlowNode, facts: RunFacts): Entered {
  switch (node.type) {
    case "end": return { kind: "step", step: { status: "completed", nodeId: node.id } };
    case "start": return { kind: "follow", handle: "next" };
    case "condition": {
      const rule = node.rules.find((item) => matches(item.field, item.value, facts));
      return { kind: "follow", handle: rule?.id ?? "else" };
    }
    case "wait": return { kind: "step", step: { status: "waiting", nodeId: node.id, until: new Date(facts.now.getTime() + node.minutes * 60_000), waitingFor: "time" } };
    case "send_message": return { kind: "step", step: { status: "running", nodeId: node.id, effect: { kind: "send", nodeId: node.id, channel: node.channel, messageId: node.messageId ?? "", awaitReply: false } } };
    case "send_and_wait": return { kind: "step", step: { status: "running", nodeId: node.id, effect: { kind: "send", nodeId: node.id, channel: node.channel, messageId: node.messageId ?? "", awaitReply: true } } };
    case "ai_agent": return { kind: "step", step: { status: "running", nodeId: node.id, effect: { kind: "start_agent", nodeId: node.id, engine: node.engine, agentId: node.agentId, autonomy: node.autonomy } } };
    case "transfer": return { kind: "step", step: { status: "running", nodeId: node.id, effect: { kind: "transfer", nodeId: node.id, target: node.target, queueId: node.queueId ?? null } } };
    case "update_lead": return { kind: "step", step: { status: "running", nodeId: node.id, effect: { kind: "update_lead", nodeId: node.id, status: node.status ?? null, tag: node.tag ?? null } } };
    case "legacy_intake": return { kind: "step", step: { status: "running", nodeId: node.id, effect: { kind: "legacy_intake", nodeId: node.id } } };
  }
}

export function stepFlow(definition: FlowDefinition, currentNodeId: string | null, event: RunEvent, facts: RunFacts): StepResult {
  const byId = new Map(definition.nodes.map((node) => [node.id, node]));
  if (event.type === "start") {
    const start = definition.nodes.find((node) => node.type === "start");
    return start ? advance(definition, start.id, "next", facts) : { status: "failed", nodeId: null, reason: "Fluxo sem Início." };
  }
  const current = currentNodeId ? byId.get(currentNodeId) : null;
  if (!current) return { status: "failed", nodeId: currentNodeId, reason: "Execução sem bloco atual." };

  switch (current.type) {
    case "send_and_wait":
      if (event.type === "effect_done") return { status: "waiting", nodeId: current.id, until: new Date(facts.now.getTime() + current.timeoutMinutes * 60_000), waitingFor: "reply" };
      if (event.type === "reply") return advance(definition, current.id, "replied", { ...facts, lastReply: event.text });
      if (event.type === "timeout") return advance(definition, current.id, "no_reply", facts);
      break;
    case "ai_agent":
      if (event.type === "effect_done") return { status: "waiting", nodeId: current.id, until: null, waitingFor: "agent" };
      if (event.type === "agent_result") return advance(definition, current.id, event.outcome, facts);
      break;
    case "wait":
      if (event.type === "timeout") return advance(definition, current.id, "next", facts);
      break;
    default:
      if (event.type === "effect_done") return advance(definition, current.id, "next", facts);
  }
  // Anything else (a late reply to a plain send, a timeout after the agent...) leaves the run where it is.
  return { status: "waiting", nodeId: current.id, until: null, waitingFor: current.type === "ai_agent" ? "agent" : current.type === "send_and_wait" ? "reply" : "time" };
}

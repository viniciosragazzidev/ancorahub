/**
 * Attendance flow definition (DEC-127): the blocks of a per-queue flow and the
 * rules a version must pass before it can be published. Pure, no I/O.
 */
export type SendChannel = "lead_channel" | "meta" | "company_number";
export type AgentEngine = "legacy" | "new";
export type Autonomy = "assisted" | "supervised" | "autonomous";
export type ConditionField = "reply_contains" | "business_hours" | "service_window_open" | "lead_field_present";

export type FlowNode =
  | { id: string; type: "start" }
  | { id: string; type: "send_message"; channel: SendChannel; messageId: string | null }
  | { id: string; type: "send_and_wait"; channel: SendChannel; messageId: string | null; timeoutMinutes: number }
  | { id: string; type: "condition"; rules: Array<{ id: string; field: ConditionField; value?: string }> }
  | { id: string; type: "ai_agent"; engine: AgentEngine; agentId: string | null; autonomy: Autonomy }
  | { id: string; type: "wait"; minutes: number }
  | { id: string; type: "transfer"; target: "distribution" | "queue"; queueId?: string | null }
  | { id: string; type: "update_lead"; status?: string | null; tag?: string | null }
  | { id: string; type: "legacy_intake" }
  | { id: string; type: "end" };

export type FlowEdge = { id: string; source: string; target: string; handle?: string };
export type FlowDefinition = { nodes: FlowNode[]; edges: FlowEdge[] };
export type FlowNodeType = FlowNode["type"];

export const NODE_LABEL: Record<FlowNodeType, string> = {
  start: "Início",
  send_message: "Enviar mensagem",
  send_and_wait: "Enviar e aguardar resposta",
  condition: "Condição",
  ai_agent: "Agente de IA",
  wait: "Aguardar",
  transfer: "Transferir",
  update_lead: "Atualizar lead",
  legacy_intake: "Atendimento atual",
  end: "Encerrar",
};

/** The exits each block must have. A condition needs one per rule plus "else". */
export function requiredHandles(node: FlowNode): string[] {
  switch (node.type) {
    case "end": return [];
    case "send_and_wait": return ["replied", "no_reply"];
    case "condition": return [...node.rules.map((rule) => rule.id), "else"];
    case "ai_agent": return ["done", "failed"];
    default: return ["next"];
  }
}

/** Blocks that stop and wait for time or the lead: a loop must pass through one of them. */
function waits(node: FlowNode) {
  return node.type === "wait" || node.type === "send_and_wait" || node.type === "ai_agent";
}

export type FlowIssue = { nodeId: string | null; message: string };

export function validateFlow(definition: FlowDefinition): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const byId = new Map(definition.nodes.map((node) => [node.id, node]));
  if (byId.size !== definition.nodes.length) issues.push({ nodeId: null, message: "Dois blocos têm o mesmo identificador." });

  const starts = definition.nodes.filter((node) => node.type === "start");
  if (starts.length !== 1) issues.push({ nodeId: null, message: "O fluxo precisa de exatamente um Início." });
  if (!definition.nodes.some((node) => node.type === "end")) issues.push({ nodeId: null, message: "O fluxo precisa de pelo menos um Encerrar." });

  const outgoing = new Map<string, FlowEdge[]>();
  for (const edge of definition.edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) {
      issues.push({ nodeId: edge.source, message: "Uma ligação aponta para um bloco que não existe." });
      continue;
    }
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
  }

  for (const node of definition.nodes) {
    const edges = outgoing.get(node.id) ?? [];
    const handles = edges.map((edge) => edge.handle ?? "next");
    for (const handle of requiredHandles(node)) {
      const count = handles.filter((item) => item === handle).length;
      if (count === 0) issues.push({ nodeId: node.id, message: `${NODE_LABEL[node.type]}: falta ligar a saída "${handleLabel(handle)}".` });
      if (count > 1) issues.push({ nodeId: node.id, message: `${NODE_LABEL[node.type]}: a saída "${handleLabel(handle)}" está ligada duas vezes.` });
    }
    if (node.type === "end" && edges.length) issues.push({ nodeId: node.id, message: "Encerrar não pode ter saídas." });
    if ((node.type === "send_message" || node.type === "send_and_wait") && !node.messageId) issues.push({ nodeId: node.id, message: `${NODE_LABEL[node.type]}: escolha a mensagem.` });
    if (node.type === "send_and_wait" && !(node.timeoutMinutes > 0)) issues.push({ nodeId: node.id, message: "Enviar e aguardar: defina o tempo de espera." });
    if (node.type === "wait" && !(node.minutes > 0)) issues.push({ nodeId: node.id, message: "Aguardar: defina o tempo." });
    if (node.type === "condition" && !node.rules.length) issues.push({ nodeId: node.id, message: "Condição: adicione pelo menos uma regra." });
    if (node.type === "transfer" && node.target === "queue" && !node.queueId) issues.push({ nodeId: node.id, message: "Transferir: escolha a fila." });
  }

  // Every block reachable from the start.
  const start = starts[0];
  if (start) {
    const seen = new Set<string>([start.id]);
    const stack = [start.id];
    while (stack.length) {
      const id = stack.pop()!;
      for (const edge of outgoing.get(id) ?? []) if (!seen.has(edge.target)) { seen.add(edge.target); stack.push(edge.target); }
    }
    for (const node of definition.nodes) if (!seen.has(node.id)) issues.push({ nodeId: node.id, message: `${NODE_LABEL[node.type]}: bloco solto, nenhum caminho chega nele.` });
  }

  // A loop must wait for time or the lead, or it would run forever in one go.
  const color = new Map<string, "grey" | "black">();
  const path: string[] = [];
  const visit = (id: string): boolean => {
    color.set(id, "grey");
    path.push(id);
    for (const edge of outgoing.get(id) ?? []) {
      const state = color.get(edge.target);
      if (state === "grey") {
        const loop = path.slice(path.indexOf(edge.target));
        if (!loop.some((nodeId) => waits(byId.get(nodeId)!))) {
          issues.push({ nodeId: edge.target, message: "Há uma volta no fluxo sem Aguardar, resposta do lead ou agente: ela rodaria sem parar." });
          return true;
        }
      } else if (!state && visit(edge.target)) return true;
    }
    path.pop();
    color.set(id, "black");
    return false;
  };
  if (start) visit(start.id);
  return issues;
}

export function handleLabel(handle: string) {
  return ({ next: "seguir", replied: "respondeu", no_reply: "sem resposta", else: "senão", done: "concluiu", failed: "não concluiu" } as Record<string, string>)[handle] ?? handle;
}

import type { FlowDefinition } from "./definition";

/**
 * Ready-made flows (DEC-127). "current" runs exactly today's intake (the
 * distribution and the qualification the queue already does), so pointing a
 * queue at it changes nothing. The others are simple starting points.
 */
export type BuiltinFlowKey = "current" | "distribute_now" | "qualify_new_engine";

export const BUILTIN_FLOWS: Record<BuiltinFlowKey, { name: string; description: string; definition: FlowDefinition }> = {
  current: {
    name: "Atendimento atual",
    description: "Faz exatamente o que a fila faz hoje: distribuição e, se a fila tiver IA, a qualificação atual.",
    definition: {
      nodes: [
        { id: "start", type: "start" },
        { id: "legacy", type: "legacy_intake" },
        { id: "end", type: "end" },
      ],
      edges: [
        { id: "e1", source: "start", target: "legacy" },
        { id: "e2", source: "legacy", target: "end" },
      ],
    },
  },
  distribute_now: {
    name: "Direto para a distribuição",
    description: "Sem IA: o lead vai para a distribuição assim que chega.",
    definition: {
      nodes: [
        { id: "start", type: "start" },
        { id: "transfer", type: "transfer", target: "distribution" },
        { id: "end", type: "end" },
      ],
      edges: [
        { id: "e1", source: "start", target: "transfer" },
        { id: "e2", source: "transfer", target: "end" },
      ],
    },
  },
  qualify_new_engine: {
    name: "IA qualifica e distribui (motor novo)",
    description: "O agente de IA novo qualifica e passa o lead para a distribuição; se não conseguir, o fluxo distribui.",
    definition: {
      nodes: [
        { id: "start", type: "start" },
        { id: "agent", type: "ai_agent", engine: "new", agentId: null, autonomy: "autonomous" },
        { id: "transfer", type: "transfer", target: "distribution" },
        { id: "end", type: "end" },
      ],
      edges: [
        { id: "e1", source: "start", target: "agent" },
        // The engine already hands the lead to distribution when it concludes.
        { id: "e2", source: "agent", target: "end", handle: "done" },
        { id: "e3", source: "agent", target: "transfer", handle: "failed" },
        { id: "e4", source: "transfer", target: "end" },
      ],
    },
  },
};

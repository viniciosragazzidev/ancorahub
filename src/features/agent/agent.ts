import { isStepCount, ToolLoopAgent, type LanguageModel, type ToolApprovalStatus, type UIMessage } from "ai";

import type { AgentBackend } from "./backend";
import { AGENT_CATALOG, type CatalogEntry } from "./catalog-meta";
import { approvalFor, isToolVisible, type PolicyViewer } from "./policy";
import { buildDirectorInstructions } from "./prompt";
import { buildAgentTools, type AgentTools } from "./tools";

/**
 * O agente do diretor: o mesmo montador no servidor (rota da gaveta) e no laboratório (mundo em memória).
 * O modelo só vê as ferramentas que a política libera para quem pede; cada chamada passa por `approvalFor`.
 */
export const AGENT_MAX_STEPS = 8;

/** Última frase do diretor (para a trilha). */
export function lastUserText(messages: readonly UIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (message.role !== "user") continue;
    const text = message.parts.map((part) => (part.type === "text" ? part.text : "")).join(" ").trim();
    if (text) return text.slice(0, 500);
  }
  return null;
}

/** Ids das chamadas que o diretor aprovou com um toque (não automáticas). */
export function userApprovedCallIds(messages: readonly UIMessage[]) {
  const ids = new Set<string>();
  for (const message of messages) {
    for (const part of message.parts as Array<{ type: string; toolCallId?: string; approval?: { approved?: boolean; isAutomatic?: boolean } }>) {
      if (part.type.startsWith("tool-") && part.toolCallId && part.approval?.approved && !part.approval.isAutomatic) ids.add(part.toolCallId);
    }
  }
  return ids;
}

export function createDirectorAgent(input: {
  model: LanguageModel;
  backend: AgentBackend;
  viewer: PolicyViewer;
  firstName: string | null;
  messages: readonly UIMessage[];
  /** Uso de tokens por passo (a rota grava em logAiUsage). */
  onUsage?: (usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number }) => void;
}) {
  const approved = userApprovedCallIds(input.messages);
  const allTools = buildAgentTools({
    backend: input.backend,
    requestText: lastUserText(input.messages),
    approvedByUser: (toolCallId) => approved.has(toolCallId),
  });
  const entries = Object.values(AGENT_CATALOG) as CatalogEntry[];
  const visible = entries.filter((entry) => isToolVisible(entry, input.viewer)).map((entry) => entry.name);
  const tools = Object.fromEntries(Object.entries(allTools).filter(([name]) => visible.includes(name))) as Partial<AgentTools>;

  return new ToolLoopAgent({
    model: input.model,
    instructions: buildDirectorInstructions({ firstName: input.firstName, now: input.backend.now(), writesEnabled: input.viewer.writesEnabled && !input.viewer.viewAs }),
    tools: tools as AgentTools,
    stopWhen: isStepCount(AGENT_MAX_STEPS),
    temperature: 0.2,
    onStepFinish: (step) => input.onUsage?.(step.usage ?? {}),
    toolApproval: ({ toolCall }): ToolApprovalStatus => {
      const entry = (AGENT_CATALOG as Record<string, CatalogEntry>)[toolCall.toolName];
      if (!entry) return { type: "denied", reason: "Ferramenta desconhecida." };
      const decision = approvalFor(entry, input.viewer, (toolCall.input ?? {}) as Record<string, unknown>);
      // Leitura roda sem metadado de aprovação (fica igual a uma chamada comum na gaveta).
      if (decision.type === "approved") return entry.risk.readOnly ? "not-applicable" : "approved";
      if (decision.type === "denied") return { type: "denied", reason: decision.reason };
      return "user-approval";
    },
  });
}

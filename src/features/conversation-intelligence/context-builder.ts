import type { ConversationAssessment } from "./types";

export interface ContextBuilderMessage {
  id: string;
  sender: "customer" | "broker" | "system";
  content: string;
  timestamp: Date;
}

export interface ContextBuilderInput {
  lead: {
    id: string;
    nome: string;
    status: string;
    operadoraDesejada?: string | null;
    tipoPlano?: string | null;
    vidas?: number | null;
  };
  previousMemory?: {
    summary?: string;
    facts?: string[];
    objections?: string[];
    lastStage?: string;
  } | null;
  recentMessages: ContextBuilderMessage[];
  maxRecentMessages?: number;
}

export interface CompactConversationContext {
  leadSummary: string;
  historicalMemory: string;
  recentTranscript: string;
  currentStatus: string;
  messageCount: number;
}

/**
 * Constrói o contexto compacto e de alta densidade semântica para a IA,
 * evitando reenviar centenas de mensagens para o OpenRouter.
 */
export function buildConversationIntelligenceContext(
  input: ContextBuilderInput,
): CompactConversationContext {
  const maxMessages = input.maxRecentMessages ?? 12;
  const slicedMessages = input.recentMessages.slice(-maxMessages);

  // 1. Dados básicos do lead e produto
  const planInfo = [
    input.lead.tipoPlano ? `Tipo: ${input.lead.tipoPlano}` : null,
    input.lead.vidas ? `Vidas: ${input.lead.vidas}` : null,
    input.lead.operadoraDesejada ? `Operadora: ${input.lead.operadoraDesejada}` : null,
  ].filter(Boolean).join(" | ");

  const leadSummary = `Lead: ${input.lead.nome} | Status Atual: ${input.lead.status}${planInfo ? ` | ${planInfo}` : ""}`;

  // 2. Memória consolidada de análises anteriores
  const memoryParts: string[] = [];
  if (input.previousMemory?.summary) {
    memoryParts.push(`Resumo anterior: ${input.previousMemory.summary}`);
  }
  if (input.previousMemory?.facts && input.previousMemory.facts.length > 0) {
    memoryParts.push(`Fatos consolidados: ${input.previousMemory.facts.join("; ")}`);
  }
  if (input.previousMemory?.objections && input.previousMemory.objections.length > 0) {
    memoryParts.push(`Objeções conhecidas: ${input.previousMemory.objections.join(", ")}`);
  }

  const historicalMemory = memoryParts.length > 0 ? memoryParts.join("\n") : "Nenhuma memória anterior.";

  // 3. Transcrição recente formatada
  const recentTranscript = slicedMessages
    .map((m) => {
      const roleLabel = m.sender === "customer" ? "Cliente" : m.sender === "broker" ? "Corretor" : "Sistema";
      const timeStr = m.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      return `[${timeStr}] ${roleLabel}: ${m.content.trim()}`;
    })
    .join("\n");

  return {
    leadSummary,
    historicalMemory,
    recentTranscript: recentTranscript || "Nenhuma mensagem recente.",
    currentStatus: input.lead.status,
    messageCount: slicedMessages.length,
  };
}

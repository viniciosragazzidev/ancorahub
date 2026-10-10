/**
 * Central registry of the broker assistants' AI (one entry per agent).
 * The code is the default; the super-admin may later override prompt/profile/
 * enabled per agent (F4). Plan: docs/implementations/active/2026-10-10-ia-assistentes-corretor.md
 */
import { z } from "zod";

import type { ChatBlock, ChatChoice } from "@/components/chat/types";

import type { AiProfile } from "./profiles";

export const AGENT_IDS = ["ancora", "leads", "plantao", "agenda", "cotacao", "desempenho", "insights", "lead"] as const;
export type AgentId = (typeof AGENT_IDS)[number];

/** Actions an agent may SUGGEST (the broker taps; the existing server action runs with its own checks). */
export const ACTION_CATALOG = {
  "open.lead": { label: "Abrir o lead", kind: "href" },
  "open.queue": { label: "Ver meus leads", kind: "href" },
  "open.quote": { label: "Fazer uma cotação", kind: "href" },
  "open.duty": { label: "Ver meu plantão", kind: "href" },
  "open.agenda": { label: "Ver minha agenda", kind: "href" },
  "open.insights": { label: "Ver análise do cliente", kind: "href" },
  "lead.registerContact": { label: "Aceitar e chamar no WhatsApp", kind: "server" },
  "lead.scheduleReturn": { label: "Agendar retorno", kind: "server" },
  "duty.pause": { label: "Pausar o recebimento", kind: "server" },
  "duty.resume": { label: "Voltar a receber", kind: "server" },
} as const;
export type CatalogAction = keyof typeof ACTION_CATALOG;
const CATALOG_KEYS = Object.keys(ACTION_CATALOG) as [CatalogAction, ...CatalogAction[]];

export type AgentDefinition = {
  id: AgentId;
  name: string;
  purpose: string;
  profile: AiProfile;
  version: number;
  allowedActions: CatalogAction[];
  /** Sends client messages or the AI reading of a client: never to free-tier providers. */
  sensitive: boolean;
  /** Agent-specific instructions (the global rules are added by buildMessages). */
  instructions: string;
};

export const AGENT_REGISTRY: Record<AgentId, AgentDefinition> = {
  ancora: { id: "ancora", name: "Âncora", purpose: "Explicar avisos da empresa e da escala.", profile: "chat-fast", version: 1, allowedActions: ["open.duty", "open.queue"], sensitive: false, instructions: "Você é o canal oficial da Âncora. Explique avisos de forma objetiva. Não invente regras da empresa." },
  leads: { id: "leads", name: "Leads", purpose: "Priorizar e orientar o atendimento dos leads do corretor.", profile: "chat-smart", version: 1, allowedActions: ["open.lead", "open.queue", "lead.registerContact", "lead.scheduleReturn", "open.quote"], sensitive: false, instructions: "Ajude o corretor a decidir quem atender primeiro e o próximo passo com cada lead, usando só os dados do contexto." },
  plantao: { id: "plantao", name: "Plantão", purpose: "Responder sobre o plantão, a escala e a disponibilidade.", profile: "chat-fast", version: 1, allowedActions: ["open.duty", "duty.pause", "duty.resume"], sensitive: false, instructions: "Responda sobre o plantão atual e o próximo. Nunca prometa trocas de escala: isso é com a gestão." },
  agenda: { id: "agenda", name: "Agenda", purpose: "Organizar os retornos do dia.", profile: "chat-fast", version: 1, allowedActions: ["open.agenda", "open.lead", "lead.scheduleReturn"], sensitive: false, instructions: "Ajude a organizar os retornos: o que venceu, o que vem a seguir e como reagendar." },
  cotacao: { id: "cotacao", name: "Cotação", purpose: "Tirar dúvidas sobre como cotar.", profile: "chat-fast", version: 1, allowedActions: ["open.quote"], sensitive: false, instructions: "Explique como montar a cotação no app. Nunca informe preço, carência ou cobertura de plano: isso vem só do simulador ou da operadora." },
  desempenho: { id: "desempenho", name: "Desempenho", purpose: "Ler os números do dia e da meta.", profile: "chat-fast", version: 1, allowedActions: ["open.queue"], sensitive: false, instructions: "Leia os números do contexto e dê uma orientação curta e motivadora, sem inventar dados." },
  insights: { id: "insights", name: "Insights", purpose: "Dar o próximo passo e dicas a partir da análise das conversas.", profile: "chat-smart", version: 1, allowedActions: ["open.insights", "open.lead"], sensitive: false, instructions: "Use a análise das conversas do contexto para sugerir quem responder e como. Pode sugerir um texto curto de mensagem, que o corretor revisa." },
  lead: { id: "lead", name: "Conversa do lead", purpose: "Ajudar no atendimento de um lead específico.", profile: "chat-smart", version: 1, allowedActions: ["lead.registerContact", "lead.scheduleReturn", "open.quote", "open.insights"], sensitive: true, instructions: "Ajude com este lead: o que responder, qual o próximo passo. Pode sugerir um texto curto de mensagem para o WhatsApp, que o corretor revisa antes de enviar." },
};

/** What the model must answer (validated; anything else falls back). */
export const assistantReplySchema = z.object({
  text: z.string().trim().min(1).max(700),
  suggestions: z.array(z.object({ label: z.string().trim().min(2).max(60), action: z.enum(CATALOG_KEYS) })).max(4).default([]),
  draftMessage: z.string().trim().max(500).optional(),
});
export type AssistantReply = z.infer<typeof assistantReplySchema>;

const GLOBAL_RULES = [
  "Responda em português do Brasil, em tom de colega, com no máximo 3 frases curtas.",
  "Use somente os dados do CONTEXTO. Se faltar dado, diga o que não sabe.",
  "Nunca informe preço, carência, cobertura ou condição de plano; nunca prometa nada em nome da empresa.",
  "Nunca use travessão.",
  'Responda APENAS um JSON: {"text": string, "suggestions": [{"label": string, "action": string}], "draftMessage"?: string}.',
].join("\n");

export function buildMessages(agent: AgentDefinition, context: string, question: string) {
  return [
    {
      role: "system" as const,
      content: `${GLOBAL_RULES}\n\nVocê é o assistente "${agent.name}" do app do corretor da Âncora Saúde. ${agent.instructions}\nAções permitidas em "suggestions" (use o código exato): ${agent.allowedActions.join(", ")}.`,
    },
    { role: "user" as const, content: `CONTEXTO:\n${context}\n\nPERGUNTA DO CORRETOR:\n${question}` },
  ];
}

/** Where each suggested action leads (the broker's own data fills the ids). */
export type ActionTargets = { leadId?: string | null; whatsappUrl?: string | null };

function toChoice(action: CatalogAction, label: string, index: number, targets: ActionTargets): ChatChoice | null {
  const id = `ai-${index}-${action}`;
  switch (action) {
    case "open.lead": return targets.leadId ? { id, label, action: { kind: "href", href: `/leads/${targets.leadId}` } } : { id, label, action: { kind: "href", href: "/minha-fila" } };
    case "open.queue": return { id, label, action: { kind: "href", href: "/minha-fila" } };
    case "open.quote": return { id, label, action: { kind: "href", href: "/cotacao" } };
    case "open.duty": return { id, label, action: { kind: "href", href: "/dashboard/c/plantao" } };
    case "open.agenda": return { id, label, action: { kind: "href", href: "/dashboard/c/agenda" } };
    case "open.insights": return targets.leadId ? { id, label, action: { kind: "href", href: `/conversas/broker?insight=${encodeURIComponent(targets.leadId)}` } } : { id, label, action: { kind: "href", href: "/conversas/broker" } };
    case "lead.registerContact": return targets.leadId ? { id, label, action: { kind: "server", name: "lead.registerContact", payload: { leadId: targets.leadId } } } : null;
    case "lead.scheduleReturn": return targets.leadId ? { id, label, action: { kind: "server", name: "lead.scheduleReturn", payload: { leadId: targets.leadId, when: "tomorrow" } } } : null;
    case "duty.pause": return { id, label, action: { kind: "server", name: "duty.pause", payload: {} } };
    case "duty.resume": return { id, label, action: { kind: "server", name: "duty.resume", payload: {} } };
  }
}

/** The model's reply as chat blocks: only allowed actions survive, everything is plain data. */
export function replyToBlocks(agent: AgentDefinition, reply: AssistantReply, targets: ActionTargets, stamp: string): ChatBlock[] {
  const blocks: ChatBlock[] = [{ type: "assistant", id: `ai-text-${stamp}`, text: reply.text }];
  if (reply.draftMessage) {
    blocks.push({ type: "assistant", id: `ai-draft-${stamp}`, text: `Sugestão de mensagem:\n"${reply.draftMessage}"` });
    if (targets.whatsappUrl) {
      const href = `${targets.whatsappUrl.split("?")[0]}?text=${encodeURIComponent(reply.draftMessage)}`;
      blocks.push({ type: "button", id: `ai-send-${stamp}`, label: "Abrir no WhatsApp com esse texto", href, tone: "whatsapp" });
    }
  }
  const choices = reply.suggestions
    .filter((suggestion) => agent.allowedActions.includes(suggestion.action))
    .map((suggestion, index) => toChoice(suggestion.action, suggestion.label, index, targets))
    .filter((choice): choice is ChatChoice => Boolean(choice));
  if (choices.length) blocks.push({ type: "question", id: `ai-choices-${stamp}`, prompt: "Quer fazer agora?", choices });
  return blocks;
}

import "server-only";

import { z } from "zod";

import { runGateway } from "@/features/ai-gateway/gateway";

import { SASA_STAGES, type SasaIntent } from "./intent-rules";

/**
 * Interpretador por IA (D1: JSON + zod pelo gateway): só quando as regras não casaram. O modelo escolhe uma
 * ferramenta da lista e devolve o nome e a data COMO TEXTO; quem acha o lead e calcula a data é o servidor.
 * Contexto mínimo (plano §3.5): primeiros nomes dos leads e a hora local; nada de telefone, CPF ou mensagem.
 */
const replySchema = z.object({
  tool: z.enum(["duty.next", "duty.pause", "duty.resume", "leads.waiting", "agenda.list", "returns.schedule", "returns.reschedule", "returns.complete", "returns.cancel", "lead.stage", "lead.note", "sale.start", "quote.start", "lead.accept", "lead.decline", "lead.lost", "message.draft", "none"]),
  lead: z.string().trim().max(80).nullish(),
  when: z.string().trim().max(80).nullish(),
  status: z.enum(SASA_STAGES).nullish(),
});

const TOOL_GUIDE = [
  "duty.next: quando é o plantão (agora ou o próximo).",
  "duty.pause: pausar o recebimento de leads.",
  "duty.resume: voltar a receber leads.",
  "leads.waiting: quem está esperando resposta ou atendimento.",
  "leads.recover: quem recuperar hoje (leads parados em negociação, sem retorno marcado).",
  "agenda.list: o que tem na agenda, retornos de hoje.",
  "returns.schedule: marcar retorno com um lead (lead e when).",
  "returns.reschedule: mudar o horário de um retorno que já existe (lead e when).",
  "returns.complete: o corretor já falou com o lead, concluir o retorno (lead).",
  "returns.cancel: cancelar o retorno de um lead (lead).",
  "lead.stage: mudar a etapa do lead (lead e status: quote_sent, negotiation ou documentation_pending).",
  "lead.note: o corretor conta o que o cliente disse ou pediu (lead).",
  "sale.start: o corretor fechou a venda com um lead (lead; copie no when o trecho de início da vigência, se houver).",
  "quote.start: o corretor quer uma cotação ou simulação (idades e tipo ficam no texto).",
  "lead.accept: aceitar o lead novo que foi oferecido (lead, se disser).",
  "lead.decline: recusar o lead novo oferecido (lead, se disser; o motivo fica no texto).",
  "lead.lost: o cliente desistiu ou foi perdido, encerrar o atendimento (lead; o motivo fica no texto).",
  "message.draft: escrever uma mensagem para o cliente (lead; o recado fica no texto). Nunca envia.",
  "none: qualquer outra coisa (pergunta geral, dúvida de plano, conversa).",
].join("\n");

export async function interpretSasaText(input: { tenantId: string; userId: string; text: string; leadFirstNames: string[]; nowLabel: string }): Promise<{ intent: SasaIntent; leadHint: string | null; whenText: string | null } | null> {
  const result = await runGateway({
    profile: "chat-fast",
    purpose: "sasa_command",
    tenantId: input.tenantId,
    userId: input.userId,
    sensitive: true,
    maskPersonalData: true,
    maxTokens: 120,
    temperature: 0,
    totalTimeoutMs: 8_000,
    schema: replySchema,
    messages: [
      {
        role: "system",
        content: `Você interpreta pedidos de um corretor de plano de saúde para a assistente Sasá. Escolha UMA ferramenta:\n${TOOL_GUIDE}\nNunca invente nome: copie o nome como o corretor disse. Em "when", copie o trecho de data e hora como foi dito (ex.: "amanhã às 10"); não calcule datas. Responda APENAS um JSON: {"tool": string, "lead"?: string, "when"?: string, "status"?: string}.`,
      },
      { role: "user", content: `Agora: ${input.nowLabel}. Primeiros nomes dos leads do corretor: ${input.leadFirstNames.slice(0, 40).join(", ") || "nenhum"}.\nPEDIDO: ${input.text}` },
    ],
  });
  if (!result.ok) return null;
  const value = result.value;
  const leadHint = value.lead || null;
  const whenText = value.when || null;
  switch (value.tool) {
    case "none": return null;
    case "returns.reschedule": return { intent: { tool: "returns.schedule", reschedule: true }, leadHint, whenText };
    case "returns.schedule": return { intent: { tool: "returns.schedule", reschedule: false }, leadHint, whenText };
    case "lead.stage": return value.status ? { intent: { tool: "lead.stage", status: value.status }, leadHint, whenText } : null;
    case "duty.next": case "duty.pause": case "duty.resume": case "leads.waiting": case "agenda.list": case "returns.complete": case "returns.cancel": case "lead.note": case "sale.start": case "quote.start":
    case "lead.accept": case "lead.decline": case "lead.lost": case "message.draft":
      return { intent: { tool: value.tool }, leadHint, whenText };
    default: return null;
  }
}

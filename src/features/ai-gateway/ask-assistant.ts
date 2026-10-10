"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import type { ChatBlock } from "@/components/chat/types";
import { getCachedBrokerWorkspaceData } from "@/features/broker-workspace/chat/chat-rail-data";
import { nextStepText, readLeadIntelligence } from "@/features/broker-workspace/chat/intelligence";
import { canRevealLightContact } from "@/features/broker-workspace/lead-contact-privacy";
import { buildLeadScopeWhere } from "@/features/leads/lead-authorization";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { AGENT_IDS, AGENT_REGISTRY, assistantReplySchema, buildMessages, replyToBlocks, type ActionTargets, type AgentId } from "./agents";
import { runGateway } from "./gateway";
import { maskPersonalData, shortName } from "./privacy";

const TIME_ZONE = "America/Sao_Paulo";
const hhmm = (date: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
const ddmm = (date: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" }).format(date);

const inputSchema = z.object({
  agentId: z.enum(AGENT_IDS),
  question: z.string().trim().min(1).max(500),
  leadId: z.string().min(1).max(80).optional(),
});

/** The broker's day as plain text for the model (short names, no contact data). */
async function workspaceContext() {
  const data = await getCachedBrokerWorkspaceData();
  const lines = [
    `Corretor: ${data.viewer.name.split(/\s+/)[0]}. Unidade: ${data.viewer.branchName}. Disponibilidade: ${data.viewer.availabilityStatus}.`,
    `Hoje: ${data.today.receivedToday} recebidos, ${data.today.acceptedToday} aceitos, ${data.today.inServiceNow} em atendimento, ${data.today.slaAtRiskNow} com primeiro contato atrasando, ${data.today.returnsDue} retornos, ${data.today.awaitingResponse} esperando resposta.`,
  ];
  if (data.duty?.active) lines.push(`Plantão agora: ${data.duty.active.scheduleName}, ${hhmm(data.duty.active.startsAt)} às ${hhmm(data.duty.active.endsAt)}${data.duty.active.paused ? ", pausado" : ""}.`);
  else if (data.duty?.next) lines.push(`Próximo plantão: ${data.duty.next.scheduleName}, ${ddmm(data.duty.next.startsAt)} ${hhmm(data.duty.next.startsAt)}.`);
  if (data.goal) lines.push(`Meta: ${data.goal.name}, ${data.goal.currentValue} de ${data.goal.targetValue} (${data.goal.percentage}%).`);
  if (data.agenda.length) lines.push(`Agenda: ${data.agenda.slice(0, 8).map((item) => `${item.dueAt ? hhmm(item.dueAt) : "sem hora"} ${maskPersonalData(item.title)} (${shortName(item.leadName)})`).join("; ")}.`);
  if (data.queue.length) lines.push(`Leads: ${data.queue.slice(0, 12).map((lead) => `${shortName(lead.name)} [${lead.status}${lead.nextAction ? `, ${lead.nextAction.kind}` : ""}]`).join("; ")}.`);
  const targets: ActionTargets = { leadId: data.nextAction?.leadId ?? data.queue[0]?.id ?? null };
  return { text: lines.join("\n"), targets };
}

/** One lead as plain text: status, AI reading and the last messages (only for its own broker after accepting). */
async function leadContext(leadId: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [lead] = await db.select({
    id: schema.leads.id,
    nome: schema.leads.nome,
    status: schema.leads.status,
    tipo: schema.leads.tipo,
    telefone: schema.leads.telefone,
    corretorId: schema.leads.corretorId,
    qualificationDetails: schema.leads.qualificationDetails,
  }).from(schema.leads).where(and(eq(schema.leads.id, leadId), isNull(schema.leads.deletedAt), buildLeadScopeWhere(context))).limit(1);
  if (!lead) return null;
  const reveal = canRevealLightContact({ status: lead.status, isCurrentBroker: lead.corretorId === context.userId });
  const ai = readLeadIntelligence(lead.qualificationDetails);
  const lines = [`Lead: ${shortName(lead.nome)}. Tipo: ${lead.tipo ?? "não informado"}. Etapa: ${lead.status}.`];
  if (ai.summary) lines.push(`Resumo da IA: ${ai.summary}`);
  if (ai.nextBestAction) lines.push(`Próximo passo sugerido antes: ${maskPersonalData(nextStepText(ai.nextBestAction) ?? "")}`);
  if (ai.objections?.length) lines.push(`Objeções: ${ai.objections.join("; ")}`);
  if (reveal) {
    const messages = await db.select({ body: schema.whatsappMessages.body, direction: schema.whatsappMessages.direction, senderRole: schema.whatsappMessages.senderRole })
      .from(schema.whatsappMessages)
      .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), eq(schema.whatsappMessages.leadId, lead.id)))
      .orderBy(desc(schema.whatsappMessages.sentAt))
      .limit(10);
    if (messages.length) {
      lines.push("Últimas mensagens (mais antiga primeiro):");
      for (const message of messages.reverse()) {
        const outbound = message.direction === "outgoing" || message.direction === "outbound";
        const who = outbound ? (message.senderRole === "assistant" ? "Qualificação" : "Corretor") : "Cliente";
        lines.push(`${who}: ${maskPersonalData(message.body ?? "").slice(0, 300)}`);
      }
    }
  }
  const targets: ActionTargets = { leadId: lead.id, whatsappUrl: reveal ? buildWhatsAppUrl(lead.telefone) : null };
  return { text: lines.join("\n"), targets };
}

const FALLBACK_TEXT = "Ainda não entendo texto livre aqui. Escolha uma das opções ou use @ para abrir outra conversa.";

/**
 * Free text from the broker to an assistant: context of the route/agent, the
 * gateway (free models first) and a structured reply turned into chat blocks.
 * Off unless the BROKER_AI_ASSISTANTS flag is on; any failure keeps today's answer.
 */
export async function askAssistantAction(raw: { agentId: AgentId; question: string; leadId?: string }): Promise<{ ok: boolean; blocks: ChatBlock[] }> {
  const stamp = String(Date.now());
  const fallback = (text = FALLBACK_TEXT) => ({ ok: false, blocks: [{ type: "assistant" as const, id: `ai-fallback-${stamp}`, text }] });
  const input = inputSchema.safeParse(raw);
  if (!input.success) return fallback();
  if ((await getFeatureFlag(FEATURE_FLAGS.BROKER_AI_ASSISTANTS).catch(() => "false")) !== "true") return fallback();

  const context = await getRequiredTenantContext();
  if (context.role !== "broker") return fallback();
  const agent = AGENT_REGISTRY[input.data.agentId];
  const built = input.data.agentId === "lead" && input.data.leadId
    ? await leadContext(input.data.leadId).catch(() => null)
    : await workspaceContext().catch(() => null);
  if (!built) return fallback();

  const result = await runGateway({
    profile: agent.profile,
    purpose: `broker_assistant:${agent.id}`,
    tenantId: context.tenantId,
    userId: context.userId,
    messages: buildMessages(agent, built.text, input.data.question),
    schema: assistantReplySchema,
    maxTokens: 450,
    temperature: 0.3,
    leadId: built.targets.leadId ?? null,
    sensitive: agent.sensitive,
  });
  if (!result.ok) {
    return fallback(result.reason === "rate_limited"
      ? "Muitas perguntas seguidas. Espere um minutinho e tente de novo."
      : "Não consegui pensar nisso agora. Tente de novo em instantes ou escolha uma das opções.");
  }
  return { ok: true, blocks: replyToBlocks(agent, result.value, built.targets, stamp) };
}

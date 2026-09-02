import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { generateObject } from "ai";

import { getAiEngineSettings } from "@/features/ai/engine";
import { getAiModelInstance } from "@/features/ai/providers";
import { publishNotification } from "@/features/notifications/send-push-helper";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getSystemSetting } from "@/features/system-settings/queries";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { getDatabase, schema } from "@/shared/db";
import { conversationIntelligenceDomainRoot } from "@/shared/domain-root/conversation-intelligence-root";

import {
  buildConversationIntelligenceContext,
  type ContextBuilderMessage,
} from "./context-builder";
import { evaluateAssessmentPolicy } from "./policy-executor";
import {
  ConversationAssessmentSchema,
  type ConversationAssessment,
  type LeadIntelligenceState,
  type PolicyExecutionResult,
} from "./types";

export interface AnalyzeLeadConversationResult {
  analyzed: boolean;
  reason?: string;
  assessment?: ConversationAssessment;
  policyResult?: PolicyExecutionResult;
  state?: LeadIntelligenceState;
}

/**
 * Analisa a conversa de WhatsApp de um lead, gera percepção comercial estruturada via IA,
 * aplica a política de segurança determinística e registra feedback e transições no CRM.
 */
export async function analyzeLeadConversation(
  leadId: string,
  tenantId: string,
): Promise<AnalyzeLeadConversationResult> {
  const db = getDatabase();

  // 1. Verificar se a flag de inteligência conversacional está ativa
  const isEnabled = await getSystemSetting(FEATURE_FLAGS.CONVERSATION_INTELLIGENCE.key);
  if (isEnabled === "false") {
    return { analyzed: false, reason: "Inteligência conversacional desativada globalmente." };
  }

  // 2. Carregar dados do lead
  const [lead] = await db
    .select({
      id: schema.leads.id,
      tenantId: schema.leads.tenantId,
      branchId: schema.leads.branchId,
      corretorId: schema.leads.corretorId,
      nome: schema.leads.nome,
      telefone: schema.leads.telefone,
      status: schema.leads.status,
      qualificationDetails: schema.leads.qualificationDetails,
      formData: schema.leads.formData,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId)))
    .limit(1);

  if (!lead) {
    return { analyzed: false, reason: "Lead não encontrado." };
  }

  // 3. Buscar mensagens recentes de WhatsApp do lead
  const messages = await db
    .select({
      id: schema.whatsappMessages.id,
      direction: schema.whatsappMessages.direction,
      body: schema.whatsappMessages.body,
      sentAt: schema.whatsappMessages.sentAt,
      senderRole: schema.whatsappMessages.senderRole,
    })
    .from(schema.whatsappMessages)
    .where(and(eq(schema.whatsappMessages.tenantId, tenantId), eq(schema.whatsappMessages.leadId, leadId)))
    .orderBy(desc(schema.whatsappMessages.sentAt))
    .limit(15);

  if (messages.length === 0) {
    return { analyzed: false, reason: "Nenhuma mensagem de WhatsApp registrada para o lead." };
  }

  // Ordenar cronologicamente para o contexto
  const chronological = [...messages].reverse();
  const contextMessages: ContextBuilderMessage[] = chronological.map((m) => ({
    id: m.id,
    sender: m.direction === "incoming" ? "customer" : "broker",
    content: m.body,
    timestamp: m.sentAt,
  }));

  // 4. Extrair memória anterior se existir
  const qualDetails = (lead.qualificationDetails as Record<string, any>) || {};
  const previousAssessment = qualDetails.aiIntelligence as ConversationAssessment | undefined;

  const previousMemory = previousAssessment
    ? {
        summary: previousAssessment.summary,
        facts: previousAssessment.facts,
        objections: previousAssessment.objections,
        lastStage: previousAssessment.conversationStage,
      }
    : null;

  const compactContext = buildConversationIntelligenceContext({
    lead: {
      id: lead.id,
      nome: lead.nome,
      status: lead.status,
      operadoraDesejada: qualDetails.operadoraDesejada || null,
      tipoPlano: qualDetails.tipoPlano || null,
      vidas: qualDetails.qtdVidas ? Number(qualDetails.qtdVidas) : null,
    },
    previousMemory,
    recentMessages: contextMessages,
    maxRecentMessages: conversationIntelligenceDomainRoot.defaults.maxRecentMessagesInContext,
  });

  // 5. Configurar IA e executar chamada estruturada
  const aiSettings = await getAiEngineSettings();
  if (!aiSettings.enabled) {
    return { analyzed: false, reason: "Motor de IA desativado nas configurações do sistema." };
  }

  const keys = {
    groqKey: aiSettings.groqApiKey,
    openaiKey: aiSettings.openaiApiKey,
    googleKey: aiSettings.googleApiKey,
    openrouterKey: aiSettings.openrouterApiKey,
  };

  const modelInstance = getAiModelInstance(
    aiSettings.primaryProvider,
    aiSettings.primaryModel,
    keys,
  );

  const systemPrompt = `Você é um analista sênior de inteligência comercial do CRM CorreTop / Âncora Saúde.
Sua missão é analisar transcrições de conversas no WhatsApp entre clientes e corretores de planos de saúde/seguros e produzir um diagnóstico comercial acionável.

Orientações:
1. Identifique com precisão o estágio real da conversa (INITIAL_CONTACT, DISCOVERY, QUALIFICATION, QUOTE_PREPARATION, QUOTE_PRESENTED, NEGOTIATION, DOCUMENT_COLLECTION, CLOSING, POST_SALE, UNKNOWN).
2. Avalie a intenção de compra do cliente (VERY_HIGH, HIGH, MEDIUM, LOW, NONE, UNKNOWN) e o engajamento.
3. Extraia objeções reais (ex: preço, carência, rede hospitalar, coparticipação, tempo de resposta).
4. Identifique sinais de compra explícitos (ex: pediu tabela, pediu boleto/contrato, enviou documentos, confirmou vidas).
5. Declare com clareza quem está com a pendência no momento (BROKER, CUSTOMER, INTERNAL, NONE).
6. Sugira a próxima melhor ação comercial específica para o corretor avançar e fechar a venda.
7. Se houver clareza de transição de status no funil, informe em suggestedLeadStatus (valores possíveis: distributed, in_contact, quote_sent, negotiation, documentation_pending, under_analysis, lost) e statusConfidence (0.0 a 1.0).
8. Produza um resumo executivo objetivo em português do Brasil sem jargões desnecessários.`;

  const userPrompt = `Contexto do Lead:\n${compactContext.leadSummary}\n\nMemória Anterior:\n${compactContext.historicalMemory}\n\nTranscrição Recente:\n${compactContext.recentTranscript}`;

  let assessment: ConversationAssessment;
  try {
    const aiResult = await generateObject({
      model: modelInstance,
      schema: ConversationAssessmentSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.2,
    });
    assessment = aiResult.object;
  } catch (error) {
    console.error("[conversation-intelligence] Falha na chamada da IA:", error);
    return {
      analyzed: false,
      reason: `Falha ao processar análise da IA: ${error instanceof Error ? error.message : "erro desconhecido"}`,
    };
  }

  // 6. Avaliar políticas determinísticas do Pipeline
  const policyResult = evaluateAssessmentPolicy({
    assessment,
    currentLeadStatus: lead.status,
    config: conversationIntelligenceDomainRoot.defaults,
  });

  const now = new Date();
  const state: LeadIntelligenceState = {
    leadId: lead.id,
    tenantId: lead.tenantId,
    assessment,
    lastAnalyzedAt: now,
    lastAnalyzedMessageId: messages[0]?.id ?? null,
    conversationRevision: messages.length,
    aiModel: `${aiSettings.primaryProvider}/${aiSettings.primaryModel}`,
  };

  // 7. Persistir o feedback e aplicar transição segura se autorizado
  const actorUserId = lead.corretorId || (await resolveSystemUserId(lead.tenantId));

  await db.transaction(async (tx) => {
    // 7.1 Se autorizado auto-transição segura, atualizar status do lead
    if (policyResult.action === "AUTO_TRANSITION" && policyResult.transitionAllowed && policyResult.targetStatus) {
      await tx
        .update(schema.leads)
        .set({
          status: policyResult.targetStatus as any,
          stageEnteredAt: now,
          updatedAt: now,
        })
        .where(eq(schema.leads.id, lead.id));

      await tx.insert(schema.leadInteractions).values({
        id: randomUUID(),
        leadId: lead.id,
        userId: actorUserId,
        tipo: "status_change",
        conteudo: `Status atualizado automaticamente para '${policyResult.targetStatus}' pela IA com ${(assessment.statusConfidence * 100).toFixed(0)}% de confiança. Motivo: ${policyResult.reason}`,
        metadata: {
          source: "AI",
          fromStatus: policyResult.fromStatus,
          toStatus: policyResult.targetStatus,
          confidence: assessment.statusConfidence,
        },
        createdAt: now,
      });
    }

    // 7.2 Atualizar qualificationDetails com o estado mais recente de IA
    const updatedQualDetails = {
      ...qualDetails,
      aiIntelligence: assessment,
      aiPolicyResult: {
        action: policyResult.action,
        confidence: policyResult.confidence,
        targetStatus: policyResult.targetStatus,
        reason: policyResult.reason,
      },
      aiLastAnalyzedAt: now.toISOString(),
    };

    await tx
      .update(schema.leads)
      .set({
        qualificationDetails: updatedQualDetails,
        updatedAt: now,
      })
      .where(eq(schema.leads.id, lead.id));

    // 7.3 Inserir feedback estruturado na timeline do lead
    await tx.insert(schema.leadInteractions).values({
      id: randomUUID(),
      leadId: lead.id,
      userId: actorUserId,
      tipo: "system_alert",
      conteudo: `[IA Feedback] ${assessment.summary}\n\nPróxima Ação: ${assessment.nextBestAction}`,
      metadata: {
        source: "AI",
        assessment,
        policyResult: {
          action: policyResult.action,
          targetStatus: policyResult.targetStatus,
          confidence: policyResult.confidence,
        },
      },
      createdAt: now,
    });

    // 7.4 Log de auditoria para o Super-Admin
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: actorUserId,
      entidade: "lead_conversation_intelligence",
      entidadeId: lead.id,
      acao: `ai_feedback.generated:${policyResult.action}`,
      createdAt: now,
    });
  });

  // 8. Notificar o corretor responsável com push + toast
  if (lead.corretorId) {
    const notifTitle = policyResult.action === "AUTO_TRANSITION"
      ? `IA atualizou status de ${lead.nome}`
      : policyResult.action === "SUGGEST"
      ? `Sugestão de avanço para ${lead.nome}`
      : `Novo diagnóstico de IA: ${lead.nome}`;

    const notifMsg = policyResult.action === "SUGGEST"
      ? `A IA sugere mover para '${policyResult.targetStatus}'. Próxima ação: ${assessment.nextBestAction}`
      : `${assessment.summary.slice(0, 140)}`;

    void publishNotification({
      capability: "lead_ai_insight",
      tenantId: lead.tenantId,
      recipientUserId: lead.corretorId,
      leadId: lead.id,
      type: "lead_ai_insight",
      title: notifTitle,
      message: notifMsg,
      url: `/leads/${lead.id}`,
      tag: `ai-insight-${lead.id}`,
    }).catch((err) => console.warn("[conversation-intelligence] Notificação não enviada:", err));
  }

  return {
    analyzed: true,
    assessment,
    policyResult,
    state,
  };
}

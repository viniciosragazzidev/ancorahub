import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { getAiEngineSettings } from "@/features/ai/engine";
import { runGateway } from "@/features/ai-gateway/gateway";
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
import { analysisNews, evaluateAssessmentPolicy, isUsableAssessment } from "./policy-executor";
import { getTenantPlaybooks } from "@/features/ai-qualification/playbooks-storage";
import { MOTIVOS_PERDA, LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import { changeLeadStatus } from "@/features/leads/change-lead-status";
import type { TenantContext } from "@/shared/auth/types";
import { getAiStageMode } from "./stage-mode";
import { conversationMessageBody } from "@/features/conversations/message-media-text";
import { recentlyUndoneAiMove, type AiAutoMove } from "./ai-move";
import { applyAiSaleDetection, notifyAiSaleDetected, notifyAiSaleSuggested, validateSaleCompletionForLead } from "./sale-detection";
import { aiSaleMarkerStatus, mergeSaleCompletedWithExplicitEvidence, readSaleCompleted, readValidatedPaymentEvidence, type AiSaleDetection } from "./sale-detection-core";
import {
  ConversationAssessmentSchema,
  type ConversationAssessment,
  type LeadIntelligenceState,
  type PolicyExecutionResult,
} from "./types";

/** The gateway asks for plain JSON (no schema-guided generation), so the shape goes in the prompt. */
const ASSESSMENT_JSON_INSTRUCTION = `Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois, e seja conciso (cada lista com no máximo 3 itens curtos; summary com até 3 frases), com estas chaves:
{
  "conversationStage": "INITIAL_CONTACT|DISCOVERY|QUALIFICATION|QUOTE_PREPARATION|QUOTE_PRESENTED|NEGOTIATION|DOCUMENT_COLLECTION|ANALYSIS|CLOSING|POST_SALE|UNKNOWN",
  "customerIntent": "VERY_HIGH|HIGH|MEDIUM|LOW|NONE|UNKNOWN",
  "engagement": "HIGH|MEDIUM|LOW",
  "sentiment": "POSITIVE|NEUTRAL|NEGATIVE",
  "objections": ["..."],
  "buyingSignals": ["..."],
  "pendingFrom": "BROKER|CUSTOMER|INTERNAL|NONE|UNKNOWN",
  "nextBestAction": "próxima ação concreta para o corretor",
  "suggestedLeadStatus": "distributed|in_contact|quote_sent|negotiation|documentation_pending|under_analysis|lost" ou null,
  "statusConfidence": número de 0 a 1,
  "statusReason": "uma ou duas frases" ou null,
  "lossReasonCode": "${MOTIVOS_PERDA.join("|")}" ou null,
  "evidence": ["trecho literal do cliente (no máximo 5)"],
  "summary": "resumo executivo em português",
  "risk": "texto" ou null,
  "opportunity": "texto" ou null,
  "directorBrief": "leitura para a direção, até 2 frases",
  "directorAttention": "NONE|WATCH|ACT",
  "directorAction": "o que a direção deve fazer" ou null,
  "saleCompleted": { "status": "confirmed|likely|no", "signals": ["payment|proposal_transmitted|contract_signed|card_or_proposal_number|medical_interview_approved|interview"], "evidence": ["Cliente: trecho copiado da mensagem", "Corretor: trecho copiado da mensagem"] },
  "facts": ["..."],
  "inferences": ["..."]
}`;

export interface AnalyzeLeadConversationResult {
  analyzed: boolean;
  reason?: string;
  assessment?: ConversationAssessment;
  policyResult?: PolicyExecutionResult;
  state?: LeadIntelligenceState;
}

/**
 * Leads being analysed in this process. The analysis runs 1 minute after the last message
 * (webhook debounce) and the 1-minute job is the safety net: both may reach the same lead.
 */
const analysesInFlight = new Set<string>();

/**
 * Analisa a conversa de WhatsApp de um lead, gera percepção comercial estruturada via IA,
 * aplica a política de segurança determinística e registra feedback e transições no CRM.
 */
export async function analyzeLeadConversation(leadId: string, tenantId: string): Promise<AnalyzeLeadConversationResult> {
  if (analysesInFlight.has(leadId)) return { analyzed: false, reason: "Análise deste lead já em andamento." };
  analysesInFlight.add(leadId);
  try {
    return await runLeadConversationAnalysis(leadId, tenantId);
  } finally {
    analysesInFlight.delete(leadId);
  }
}

async function runLeadConversationAnalysis(
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
      version: schema.leads.version,
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
      mediaKind: schema.whatsappMessages.mediaKind,
      mediaFilename: schema.whatsappMessages.mediaFilename,
    })
    .from(schema.whatsappMessages)
    .where(and(eq(schema.whatsappMessages.tenantId, tenantId), eq(schema.whatsappMessages.leadId, leadId)))
    .orderBy(desc(schema.whatsappMessages.sentAt))
    .limit(conversationIntelligenceDomainRoot.defaults.maxRecentMessagesInContext);

  if (messages.length === 0) {
    return { analyzed: false, reason: "Nenhuma mensagem de WhatsApp registrada para o lead." };
  }

  // Ordenar cronologicamente para o contexto
  const chronological = [...messages].reverse();
  // Bot and automatic messages ("assistant"/"system") are not the broker talking.
  const senderOf = (m: (typeof messages)[number]): ContextBuilderMessage["sender"] =>
    m.direction === "incoming" ? "customer" : m.senderRole === "assistant" || m.senderRole === "system" ? "system" : "broker";
  const contextMessages: ContextBuilderMessage[] = chronological.map((m) => ({
    id: m.id,
    sender: senderOf(m),
    // A quote sent as "Calculo.pdf" reached the AI as "[document]" (28/10, Magma): the file name tells what it was.
    content: conversationMessageBody(m),
    timestamp: m.sentAt,
  }));
  const customerMessageCount = contextMessages.filter((m) => m.sender === "customer").length;
  const brokerMessageCount = contextMessages.filter((m) => m.sender === "broker").length;

  // 4. Extrair memória anterior se existir
  const qualDetails = (lead.qualificationDetails as Record<string, any>) || {};
  const previousAssessment = qualDetails.aiIntelligence as ConversationAssessment | undefined;

  const previousPaymentEvidence = readValidatedPaymentEvidence(qualDetails);
  const previousMemory = previousAssessment || previousPaymentEvidence.length
    ? {
        summary: previousAssessment?.summary,
        facts: previousAssessment?.facts,
        objections: previousAssessment?.objections,
        lastStage: previousAssessment?.conversationStage,
        validatedPaymentEvidence: previousPaymentEvidence,
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

  // 5. IA pelo gateway (26/10): mesma cadeia e mesmas chaves do resto do CRM (Claude Haiku
  // direto primeiro, OpenRouter pago depois) e cada tentativa fica em ai_attendance_logs.
  // A lista própria de modelos usava a chave do OpenRouter salva em Configurações, que deu
  // 401 a partir de 21/10 e parou a análise sem deixar rastro.
  const aiSettings = await getAiEngineSettings();
  if (!aiSettings.enabled) {
    return { analyzed: false, reason: "Motor de IA desativado nas configurações do sistema." };
  }

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
8. Produza um resumo executivo objetivo em português do Brasil sem jargões desnecessários.
9. Sempre que sugerir um status, explique em statusReason o motivo em uma ou duas frases, e cite em evidence trechos literais das mensagens do cliente que justificam a mudança.
10. Sugira "lost" somente quando o CLIENTE deixar claro que desistiu, já contratou com outra empresa, não tem interesse ou pediu para não ser mais contatado. Nesse caso preencha lossReasonCode com um destes códigos: ${MOTIVOS_PERDA.join(", ")}. Silêncio do cliente ou mensagens só do corretor NÃO bastam para "lost".
11. Nunca invente falas do cliente; se a transcrição não trouxer mensagens do cliente, declare isso no resumo.
12. A leitura para a direção é para o diretor ou gestor, que NÃO conversa com o cliente: nada de orientar o atendimento. Em directorBrief diga, em até 2 frases e na terceira pessoa, em que pé está a venda, a chance real de fechar e como o corretor está conduzindo (respondendo no tempo, deixando o cliente sem retorno, insistindo demais, etc.). Em directorAttention use ACT quando a direção precisa agir agora (cliente sem resposta do corretor, cliente insatisfeito, venda grande travada, risco de perder por falha do atendimento), WATCH quando vale acompanhar e NONE quando está bem encaminhado. Em directorAction, só para ACT ou WATCH, diga a ação da direção (ex.: "Cobrar o corretor: o cliente pediu o valor há 2 dias e não teve resposta", "Aprovar desconto", "Repassar o lead"); para NONE use null.
13. Arquivos aparecem como "[documento: nome do arquivo]", "[imagem]", "[áudio]". Um arquivo enviado pelo corretor com nome de cotação, cálculo, proposta, simulação ou tabela de preços conta como cotação apresentada (quote_sent), mesmo sem fala do cliente; nesse caso cite em evidence o nome do arquivo. Documentos pessoais enviados pelo cliente (RG, CPF, comprovante, carteirinha) depois da cotação indicam documentação.
13a. No saleCompleted, o sinal "interview" significa que cliente ou corretor afirmou como fato consumado que a entrevista médica ou videochamada da operadora foi concluída. Pergunta, tentativa, negativa e futuro não contam. O sinal "medical_interview_approved" continua significando aprovação explícita.
14. Venda concluída (saleCompleted): seja conservador, nunca conclua venda só pela intenção ou pelo "quero fechar". Use "confirmed" SOMENTE com prova explícita na conversa de que a venda aconteceu, marcando em signals cada prova encontrada: payment (adesão ou primeira mensalidade paga: o cliente diz "paguei", "pix feito", "já paguei a adesão", "segue o comprovante", ou envia "[imagem]"/"[documento]" de comprovante logo depois de o corretor pedir o pagamento da adesão, e a conversa liga esse arquivo ao pagamento), proposal_transmitted (o corretor diz que a proposta foi transmitida, implantada ou enviada à operadora), contract_signed (contrato ou proposta assinada), card_or_proposal_number (carteirinha ou número da proposta emitido), medical_interview_approved (entrevista médica aprovada). Use "likely" quando houver indício sem prova (ex.: imagem de comprovante sem contexto que a ligue ao pagamento, cliente dizendo que "vai pagar", proposta só preenchida). Use "no" nos demais casos. Em saleCompleted.evidence copie os trechos LITERALMENTE das mensagens da transcrição, palavra por palavra, sem resumir nem corrigir, começando por quem disse ("Cliente: paguei a adesão agora" ou "Corretor: sua proposta foi transmitida para a operadora"); um arquivo entra com o texto que aparece na transcrição (ex.: "Cliente: [documento: comprovante.pdf]"). Trecho que não está na conversa é descartado e a venda não é confirmada. Proposta assinada sozinha não basta para "confirmed"; entrevista concluída ou aprovada conta como sinal "interview".${await buildPlaybookRules(lead.tenantId)}`;

  const userPrompt = `Contexto do Lead:\n${compactContext.leadSummary}\n\nMemória Anterior:\n${compactContext.historicalMemory}\n\nTranscrição Recente:\n${compactContext.recentTranscript}`;

  const result = await runGateway({
    profile: "json-structured",
    purpose: "conversation_intelligence",
    tenantId: lead.tenantId,
    // One limiter slot per lead: the 10-min job analyses up to 20 different leads in a row.
    userId: `conversation-intelligence:${lead.id}`,
    leadId: lead.id,
    // The customer's conversation: only paid models that do not train on it (LGPD art. 11).
    sensitive: true,
    // The analysis never needs phone, e-mail, CPF or boleto numbers (LGPD art. 6 III).
    maskPersonalData: true,
    temperature: 0.2,
    // 1.500 cut Claude Haiku mid-JSON (finish_reason length, 26/10): the full assessment needs room.
    maxTokens: 4_000,
    timeoutMs: 45_000,
    schema: ConversationAssessmentSchema.refine(isUsableAssessment, "unusable_assessment"),
    messages: [
      { role: "system", content: `${systemPrompt}

${ASSESSMENT_JSON_INSTRUCTION}` },
      { role: "user", content: userPrompt },
    ],
  });

  if (!result.ok) {
    console.error("[conversation-intelligence] IA indisponível:", result.reason, result.lastError ?? "");
    return {
      analyzed: false,
      reason: `Falha ao processar análise da IA: ${result.reason}${result.lastError ? ` (${result.lastError})` : ""}`,
    };
  }
  const assessment: ConversationAssessment = result.value;
  const modelUsed = `${result.model.provider}/${result.model.model}`;
  const saleCompleted = mergeSaleCompletedWithExplicitEvidence(
    readSaleCompleted(assessment.saleCompleted),
    contextMessages.map((message) => ({ sender: message.sender, text: message.content })),
  );
  const validatedSaleEvidence = saleCompleted.status === "confirmed"
    ? await validateSaleCompletionForLead(lead.tenantId, lead.id, saleCompleted)
    : [];
  const validatedPaymentEvidence = [...new Set([
    ...readValidatedPaymentEvidence(qualDetails),
    ...validatedSaleEvidence.filter((item) => item.proves === "payment").map((item) => item.quote),
  ])].slice(0, 5);

  // 6. Avaliar políticas determinísticas do Pipeline
  const mode = await getAiStageMode(lead.tenantId);
  let policyResult: PolicyExecutionResult = evaluateAssessmentPolicy({
    assessment,
    currentLeadStatus: lead.status,
    customerMessageCount,
    brokerMessageCount,
    mode: mode === "suggest" ? "suggest" : "auto",
    config: conversationIntelligenceDomainRoot.defaults,
  });
  if (mode === "off" && policyResult.action !== "INSIGHT_ONLY") {
    policyResult = { ...policyResult, action: "INSIGHT_ONLY", transitionAllowed: false, reason: "A empresa desligou a mudança de etapa pela IA." };
  }
  // O corretor desfez um avanço da IA neste lead há menos de 7 dias (05/11): a IA só sugere, não move de novo.
  if (policyResult.action === "AUTO_TRANSITION" && recentlyUndoneAiMove(qualDetails.aiLastAutoMove as AiAutoMove | undefined)) {
    policyResult = { ...policyResult, action: "SUGGEST", transitionAllowed: false, reason: "O corretor desfez o último avanço da IA neste lead; a IA só sugere por 7 dias." };
  }

  const now = new Date();
  const state: LeadIntelligenceState = {
    leadId: lead.id,
    tenantId: lead.tenantId,
    assessment,
    lastAnalyzedAt: now,
    lastAnalyzedMessageId: messages[0]?.id ?? null,
    conversationRevision: messages.length,
    aiModel: modelUsed,
  };

  // 7. Persistir o feedback e aplicar transição segura se autorizado
  const actorUserId = lead.corretorId || (await resolveSystemUserId(lead.tenantId));

  // 7.1 Automatic move through the same service as a manual change (transition
  // rules, qualification guard, audit, realtime refresh). Guarded on the status
  // and version the analysis saw, so a change made by the broker meanwhile wins.
  let autoMove: { fromStatus: string; toStatus: string; at: string; confidence: number } | null = null;

  // 7.0 Venda detectada pela IA (10/11): prova explícita de venda (adesão paga, proposta transmitida), achada
  // na conversa real, leva o lead para Convertido uma vez, antes de qualquer outro avanço (Desfazer em 24h).
  // No modo sugestão só pede a confirmação; trecho não achado fica "unverified", sem aviso.
  let saleMarker: AiSaleDetection | null = null;
  const previousSaleMarker = aiSaleMarkerStatus(qualDetails);
  const sale = await applyAiSaleDetection({
    lead,
    saleCompleted,
    mode,
    alreadyDetected: previousSaleMarker === "converted",
    alreadySuggested: previousSaleMarker === "suggested",
    recentlyUndone: recentlyUndoneAiMove(qualDetails.aiLastAutoMove as AiAutoMove | undefined),
    actorUserId,
    validatedEvidence: validatedSaleEvidence,
  });
  if (sale.marker) saleMarker = sale.marker;
  const saleDetected = saleMarker?.status === "converted" ? saleMarker : null;
  if (saleDetected) {
    autoMove = { fromStatus: lead.status, toStatus: "converted", at: now.toISOString(), confidence: assessment.statusConfidence };
    policyResult = { ...policyResult, action: "INSIGHT_ONLY", transitionAllowed: false, targetStatus: "converted", reason: saleDetected.reason };
  }

  if (!saleDetected && policyResult.action === "AUTO_TRANSITION" && policyResult.transitionAllowed && policyResult.targetStatus) {
    const target = policyResult.targetStatus;
    const statusLabel = LEAD_STATUS_LABELS[target] ?? target;
    const evidence = assessment.evidence.length ? `\nTrechos do cliente: ${assessment.evidence.map((quote) => `"${quote}"`).join(" · ")}` : "";
    const systemContext: TenantContext = { userId: actorUserId, tenantId: lead.tenantId, role: "director", jobTitle: "system", branchId: null };
    try {
      await changeLeadStatus({ leadId: lead.id, newStatus: target, expectedVersion: lead.version }, systemContext, {
        actorUserId,
        expectedStatus: lead.status,
        auditAction: `ai_auto_move:${lead.status}->${target}`,
        interactionContent: `Status alterado automaticamente pela IA: ${LEAD_STATUS_LABELS[lead.status] ?? lead.status} → ${statusLabel} (${(assessment.statusConfidence * 100).toFixed(0)}% de confiança).\nObservação: ${assessment.statusReason?.trim() || policyResult.reason}${evidence}`,
        interactionMetadata: {
          source: "AI",
          fromStatus: lead.status,
          toStatus: target,
          confidence: assessment.statusConfidence,
          statusReason: assessment.statusReason ?? null,
          evidence: assessment.evidence,
        },
      });
      autoMove = { fromStatus: lead.status, toStatus: target, at: now.toISOString(), confidence: assessment.statusConfidence };
    } catch (error) {
      // Conflict, invalid transition or missing qualification: the broker decides.
      const message = error instanceof Error ? error.message : "erro";
      const conflict = message.startsWith("CONFLICT");
      policyResult = {
        ...policyResult,
        action: conflict ? "INSIGHT_ONLY" : "SUGGEST",
        transitionAllowed: false,
        reason: conflict
          ? "O lead mudou de etapa durante a análise; a mudança do corretor vale."
          : `Mudança automática bloqueada pelas regras do funil (${message.slice(0, 160)}); requer confirmação do corretor.`,
      };
    }
  }

  const news = analysisNews({
    autoMoved: Boolean(autoMove),
    action: policyResult.action,
    targetStatus: policyResult.targetStatus,
    previous: (qualDetails.aiPolicyResult as { action?: string | null; targetStatus?: string | null } | undefined) ?? null,
    lastNoteAt: typeof qualDetails.aiLastFeedbackNoteAt === "string" ? qualDetails.aiLastFeedbackNoteAt : null,
    now,
  });

  await db.transaction(async (tx) => {
    // 7.2 Atualizar qualificationDetails com o estado mais recente de IA
    const updatedQualDetails = {
      ...qualDetails,
      aiIntelligence: assessment,
      aiPolicyResult: {
        action: policyResult.action,
        confidence: policyResult.confidence,
        targetStatus: policyResult.targetStatus,
        fromStatus: policyResult.fromStatus,
        reason: policyResult.reason,
      },
      aiLastAnalyzedAt: now.toISOString(),
      // What "Desfazer" reverts (24h, see actions.ts). An analysis without a move keeps the last one.
      ...(autoMove ? { aiLastAutoMove: autoMove } : {}),
      ...(saleMarker ? { aiSaleDetected: saleMarker } : {}),
      ...(validatedPaymentEvidence.length ? {
        aiSaleEvidence: {
          paymentEvidence: validatedPaymentEvidence,
          validatedAt: now.toISOString(),
        },
      } : {}),
      ...(news.writeNote ? { aiLastFeedbackNoteAt: now.toISOString() } : {}),
    };

    await tx
      .update(schema.leads)
      .set({
        qualificationDetails: updatedQualDetails,
        updatedAt: now,
      })
      .where(eq(schema.leads.id, lead.id));

    // 7.3 Feedback na timeline: só com novidade (ou a cada 6h), já que a análise roda a cada conversa.
    if (news.writeNote) await tx.insert(schema.leadInteractions).values({
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

  // 8. Venda detectada: parabéns e pedido da documentação ao corretor, aviso à direção. Substitui o aviso comum.
  if (saleDetected) {
    void notifyAiSaleDetected({ tenantId: lead.tenantId, leadId: lead.id, leadName: lead.nome, brokerId: lead.corretorId, marker: saleDetected });
  }
  const saleSuggested = saleMarker?.status === "suggested" ? saleMarker : null;
  if (saleSuggested) {
    void notifyAiSaleSuggested({ tenantId: lead.tenantId, leadId: lead.id, leadName: lead.nome, brokerId: lead.corretorId, marker: saleSuggested });
  }

  // 8.1 Notificar o corretor responsável com push + toast, só quando há novidade
  if (lead.corretorId && news.notify && !saleDetected && !saleSuggested) {
    const targetLabel = policyResult.targetStatus ? LEAD_STATUS_LABELS[policyResult.targetStatus] ?? policyResult.targetStatus : "";
    const notifTitle = autoMove
      ? `IA moveu ${lead.nome} para ${targetLabel}`
      : policyResult.action === "SUGGEST"
      ? `Sugestão: mover ${lead.nome} para ${targetLabel}`
      : `Novo diagnóstico de IA: ${lead.nome}`;

    const notifMsg = autoMove
      ? `${(assessment.statusReason?.trim() || assessment.summary).slice(0, 120)} Não concorda? Abra o lead e toque em Desfazer (até 24h).`
      : policyResult.action === "SUGGEST"
      ? `Abra o lead para mover ou recusar. Próxima ação: ${assessment.nextBestAction}`
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

/**
 * The tenant's /qualificação triggers that carry a suggested status, as rules
 * the analyst must apply — so the situations the brokerage already mapped
 * (e.g. "cliente fechou com outra corretora → lost") drive the funnel.
 */
async function buildPlaybookRules(tenantId: string): Promise<string> {
  const playbooks = await getTenantPlaybooks(tenantId).catch(() => []);
  const rules = playbooks
    .filter((playbook) => playbook.enabled && playbook.suggestedLeadStatus?.trim())
    .slice(0, 20)
    .map((playbook) => `- Quando: ${playbook.triggerCondition} (${playbook.title}) → status sugerido: ${playbook.suggestedLeadStatus}`);
  return rules.length ? `\n\nGatilhos definidos pela corretora (aplique quando a conversa se encaixar):\n${rules.join("\n")}` : "";
}

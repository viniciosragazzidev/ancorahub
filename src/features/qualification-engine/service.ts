import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import type { AgentBehaviorPolicy } from "@/features/agent-training/service";
import { asksCurrentPlan, hasCoreQuoteData, type ConversationMemory } from "@/features/ai-agent/memory";
import { beneficiariesFromMemory, parseAgeValues } from "@/features/ai-agent/beneficiary-relations";
import { deriveLeadQualificationStatus } from "@/features/leads/qualification-status";
import { enqueueMetaQualificationConversion } from "@/features/meta-ads/meta-conversion-service";
import { getDatabase, schema } from "@/shared/db";
import {
  composeQuestionReply,
  beneficiaryRelationInvitation,
  DEFAULT_QUALIFIED_HANDOFF_TEXT,
  effectiveHandoffText,
  renderConversationVariables,
  summarizeQualification,
  wasQuestionAsked,
  type QualificationFieldKey,
} from "./reply-composer";

export const qualificationStates = ["NOT_STARTED", "IN_PROGRESS", "QUALIFIED", "PARTIAL", "INCONCLUSIVE", "NOT_INTERESTED"] as const;
export type QualificationState = (typeof qualificationStates)[number];

type LeadEligibilityInput = {
  origem: string;
  sourceCampaign: string | null;
  tipo: string;
  branchId: string | null;
  tags?: string[];
};

export type QualificationEvaluation = {
  state: QualificationState;
  score: number;
  completedFields: string[];
  missingFields: string[];
  qualificationStatus: "pending" | "qualified" | "hot" | "warm" | "cold";
  classification: "hot" | "warm" | "cold" | "not_qualified" | "pending";
  reasons: string[];
  completedAt: Date | null;
  qualificationVersion: string;
};

export type QualificationQuestionDefinition = {
  id: string;
  key: string;
  text: string;
  type: "text" | "choice" | "number" | "email";
  required: boolean;
  targetField: string;
  order: number;
  errorMessage: string;
};

/**
 * Defines the operational reply for a qualification turn without delegating
 * field ordering or completion to the language model. This prevents inferred
 * values and repeated questions from keeping a qualified lead in limbo.
 */
export type DeterministicQualificationTurn = {
  kind: "collecting" | "handoff";
  reply: string;
  evaluation: QualificationEvaluation;
  nextQuestion: QualificationQuestionDefinition | null;
  /** The optional relationship invitation appended to the completed handoff. */
  beneficiaryInvitation?: string;
};

/** Replaces just the handoff body and keeps any text appended to the turn, including the relation invitation. */
export function replaceHandoffTextPreservingExtension(turn: DeterministicQualificationTurn, currentHandoff: string, replacementHandoff: string): DeterministicQualificationTurn {
  const start = turn.reply.indexOf(currentHandoff);
  if (start < 0) {
    const invitation = turn.beneficiaryInvitation ? ` ${turn.beneficiaryInvitation}` : "";
    return { ...turn, reply: `${replacementHandoff}${invitation}` };
  }
  const end = start + currentHandoff.length;
  return { ...turn, reply: `${turn.reply.slice(0, start)}${replacementHandoff}${turn.reply.slice(end)}` };
}

/**
 * A lead that arrived while the assistant was paused must be eligible to enter
 * the qualification when it sends a new inbound WhatsApp message after the
 * assistant is enabled. Once a commercial qualification result exists, the
 * conversation must not be restarted automatically.
 */
export function shouldStartOrResumeAiQualification(qualificationStatus: string | null | undefined) {
  return !qualificationStatus || qualificationStatus === "pending" || qualificationStatus === "qualifying";
}

const ALL_QUESTIONS_DEFINITIONS: Record<string, QualificationQuestionDefinition> = {
  customerName: {
    id: "Q1",
    key: "customerName",
    text: "Qual é o seu nome completo?",
    type: "text",
    required: true,
    targetField: "leads.nome",
    order: 1,
    errorMessage: "Por favor, informe seu nome para continuarmos o atendimento.",
  },
  planType: {
    id: "Q2",
    key: "planType",
    text: "Você busca um plano individual/familiar ou para empresa (PJ)?",
    type: "choice",
    required: true,
    targetField: "leads.tipo",
    order: 2,
    errorMessage: "Por favor, informe se prefere um plano individual, familiar ou empresarial (PJ).",
  },
  numberOfLives: {
    id: "Q3",
    key: "numberOfLives",
    text: "Quantas pessoas serão incluídas no plano?",
    type: "number",
    required: true,
    targetField: "memory.numberOfLives",
    order: 3,
    errorMessage: "Por favor, informe o número de pessoas (vidas) que utilizarão o plano.",
  },
  age: {
    id: "Q4",
    key: "age",
    text: "Quais as idades dos beneficiários (ou média de idades se for empresa)?",
    type: "text",
    required: true,
    targetField: "memory.age",
    order: 4,
    errorMessage: "Por favor, informe as idades dos beneficiários para que possamos cotar.",
  },
  city: {
    id: "Q5",
    key: "city",
    text: "Em qual cidade você pretende utilizar o plano de saúde?",
    type: "text",
    required: true,
    targetField: "memory.city",
    order: 5,
    errorMessage: "Por favor, informe a cidade onde o plano será utilizado.",
  },
  email: {
    id: "Q6",
    key: "email",
    text: "Qual é o seu melhor e-mail para envio da proposta/cotação?",
    type: "email",
    required: true,
    targetField: "leads.email",
    order: 6,
    errorMessage: "Por favor, informe um endereço de e-mail válido para envio da cotação.",
  },
};

const memoryFieldByPolicyField: Record<string, keyof ConversationMemory> = {
  customerName: "customerName",
  planType: "planType",
  numberOfLives: "numberOfLives",
  age: "age",
  city: "city",
  email: "email",
};

export function getNextQualificationQuestion(
  memory: ConversationMemory,
  policy?: AgentBehaviorPolicy,
  _pastOutboundTexts?: Set<string>
): QualificationQuestionDefinition | null {
  void _pastOutboundTexts;
  const required = policy?.requiredFields ?? ["customerName", "planType", "numberOfLives", "age", "city", "email"];

  for (const field of required) {
    if (field === "age" && memory.planType?.value === "empresarial") {
      if (!memory.averageAge?.value) {
        const qDef = ALL_QUESTIONS_DEFINITIONS[field] ?? null;
        if (qDef) {
          // Keep the first missing field as the source of truth. If the client
          // did not answer it, later fields must not be skipped just because
          // the same question was already sent; the caller turns that case
          // into a contextual clarification.
          return qDef;
        }
      }
    } else {
      const memKey = memoryFieldByPolicyField[field];
      const val = memKey ? (memory[memKey] as { value?: string } | undefined)?.value : undefined;
      if (!val || !val.trim()) {
        const qDef = ALL_QUESTIONS_DEFINITIONS[field] ?? null;
        if (qDef) {
          return qDef;
        }
      }
    }
  }
  return null;
}

export function resolveDeterministicQualificationTurn(input: {
  memory: ConversationMemory;
  policy: AgentBehaviorPolicy;
  handoffMessage?: string | null;
  pastOutboundTexts?: Set<string>;
  /** false when the customer's last message answered nothing: no confirmation before the question. */
  answeredNow?: boolean;
  /** Fields the customer's last message filled; the confirmation echoes them. */
  answered?: string[];
  /** The reply sent right before this one (to vary the opener and the name). */
  previousReply?: string | null;
  /** The newest three replies, newest first. */
  recentReplies?: readonly string[];
  /** Stable per turn so a retry keeps the same wording. */
  seed?: string;
  /** First-reply introduction and a period greeting after six hours of silence. */
  greetingText?: string | null;
  periodGreeting?: boolean;
  now?: Date;
}): DeterministicQualificationTurn {
  const evaluation = evaluateQualification(input.memory, input.policy);
  const nextQuestion = getNextQualificationQuestion(input.memory, input.policy, input.pastOutboundTexts);

  if (!nextQuestion) {
    const invitation = beneficiaryRelationInvitation(input.memory, input.seed ?? `handoff:${evaluation.completedFields.length}`);
    const handoff = renderConversationVariables(effectiveHandoffText(input.handoffMessage, DEFAULT_QUALIFIED_HANDOFF_TEXT), input.memory);
    return {
      kind: "handoff",
      reply: invitation ? `${handoff} ${invitation}` : handoff,
      evaluation,
      nextQuestion: null,
      ...(invitation ? { beneficiaryInvitation: invitation } : {}),
    };
  }

  const key = nextQuestion.key as QualificationFieldKey;
  const answered = input.answeredNow === false
    ? []
    : (input.answered ?? []).filter((field): field is QualificationFieldKey => field in ALL_QUESTIONS_DEFINITIONS);
  const repeated = answered.length === 0
    && wasQuestionAsked(key, input.memory, nextQuestion.text, input.pastOutboundTexts ?? [], input.policy.questionTexts?.[key]);

  return {
    kind: "collecting",
    reply: composeQuestionReply({
      key,
      memory: input.memory,
      answered,
      previousReply: input.previousReply ?? input.memory.lastQuestionAsked ?? null,
      recentReplies: input.recentReplies,
      greetingText: input.greetingText,
      periodGreeting: input.periodGreeting,
      now: input.now,
      seed: input.seed ?? `${key}:${evaluation.completedFields.length}`,
      repeated,
      last: evaluation.missingFields.length === 1 && (input.policy.requiredFields?.length ?? 0) >= 3,
      customText: input.policy.questionTexts?.[key],
      // "Já têm plano hoje?" rides along with the last question, once, and is never required.
      askCurrentPlan: evaluation.missingFields.length === 1
        && !input.memory.currentPlan?.value
        && ![...(input.pastOutboundTexts ?? [])].some((text) => asksCurrentPlan(text)),
    }),
    evaluation,
    nextQuestion,
  };
}

export function leadMatchesQualificationEntryRules(lead: LeadEligibilityInput, policy: AgentBehaviorPolicy) {
  const rules = policy.qualification.entryRules;
  const matches = (values: string[], value: string | null | undefined) => values.length === 0 || Boolean(value && values.includes(value));
  return matches(rules.origins, lead.origem)
    && matches(rules.campaigns, lead.sourceCampaign)
    && matches(rules.leadTypes, lead.tipo)
    && matches(rules.branchIds, lead.branchId)
    && (rules.tags.length === 0 || (lead.tags ?? []).some((tag) => rules.tags.includes(tag)));
}

export function evaluateQualification(
  memory: ConversationMemory,
  policy?: AgentBehaviorPolicy,
  reason?: "human_requested" | "not_interested"
): QualificationEvaluation {
  const required = policy?.requiredFields ?? ["customerName", "planType", "numberOfLives", "age", "city", "email"];
  const completedFields = required.filter((field) => {
    if (field === "age" && memory.planType?.value === "empresarial") return Boolean(memory.averageAge?.value);
    return Boolean((memory[memoryFieldByPolicyField[field]] as { value?: string } | undefined)?.value);
  });
  const missingFields = required.filter((field) => !completedFields.includes(field));
  const weightedTotal = required.reduce((total, field) => total + (policy?.qualification?.fieldWeights?.[field] ?? 1), 0);
  const weightedCompleted = completedFields.reduce((total, field) => total + (policy?.qualification?.fieldWeights?.[field] ?? 1), 0);
  const score = weightedTotal ? Math.round((weightedCompleted / weightedTotal) * 100) : 0;

  const state: QualificationState = reason === "not_interested"
    ? "NOT_INTERESTED"
    : completedFields.length === required.length
      ? "QUALIFIED"
      : reason === "human_requested"
        ? "PARTIAL"
        : completedFields.length > 0 ? "IN_PROGRESS" : "NOT_STARTED";

  const reasons: string[] = [];
  if (completedFields.length > 0) {
    reasons.push(`Campos coletados (${completedFields.length}/${required.length}): ${completedFields.join(", ")}`);
  }
  if (missingFields.length > 0) {
    reasons.push(`Campos pendentes: ${missingFields.join(", ")}`);
  }

  let qualificationStatus: "pending" | "qualified" | "hot" | "warm" | "cold" = "pending";
  let classification: "hot" | "warm" | "cold" | "not_qualified" | "pending" = "pending";

  if (reason === "not_interested") {
    qualificationStatus = "cold";
    classification = "not_qualified";
    reasons.push("Lead sinalizou falta de interesse");
  } else if (state === "QUALIFIED") {
    const rawStatus = deriveLeadQualificationStatus(memory);
    const intentText = memory.intent?.value.toLowerCase() ?? "";
    const isUrgent = /(contratar|fechar|cotaç|cotac|preço|preco|urgente|agora|esta semana|hoje)/i.test(intentText);

    if (score >= 80 || isUrgent || rawStatus === "hot") {
      qualificationStatus = "hot";
      classification = "hot";
      reasons.push("Score elevado (>= 80) ou alta urgência de contratação");
    } else if (score >= 50 || rawStatus === "warm" || memory.planType?.value === "familiar" || memory.planType?.value === "empresarial") {
      qualificationStatus = "warm";
      classification = "warm";
      reasons.push("Score intermediário (50-79) ou perfil de plano familiar/PME");
    } else {
      qualificationStatus = "cold";
      classification = "cold";
      reasons.push("Score baixo (< 50) ou pesquisa sem prazo definido");
    }
  } else if (reason === "human_requested") {
    qualificationStatus = hasCoreQuoteData(memory) ? "hot" : "warm";
    classification = qualificationStatus;
    reasons.push("Transferência solicitada pelo cliente antes de concluir todas as perguntas");
  } else if (hasCoreQuoteData(memory)) {
    // Tipo, vidas e idades já dão a cotação: quente desde aqui, mesmo antes do fim (Vinicios, 23/10).
    // The state stays IN_PROGRESS, so distribution still waits for the end of the conversation.
    qualificationStatus = "hot";
    classification = "hot";
    reasons.push("Já informou tipo de plano, vidas e idades: dá para cotar");
  }
  // The same point also makes a finished qualification hot, whatever the score.
  if (state === "QUALIFIED" && hasCoreQuoteData(memory) && qualificationStatus !== "hot") {
    qualificationStatus = "hot";
    classification = "hot";
    reasons.push("Tipo de plano, vidas e idades informados");
  }

  return {
    state,
    score,
    completedFields,
    missingFields,
    qualificationStatus,
    classification,
    reasons,
    completedAt: state === "QUALIFIED" ? new Date() : null,
    qualificationVersion: "1.0",
  };
}

/**
 * PME usually starts at 2 lives (the quote simulator enforces it), but a MEI
 * with 1 life is accepted by some carriers. The AI does not refuse or re-ask:
 * it records the answer and warns the broker, who knows the carrier rules.
 */
export const PME_SINGLE_LIFE_NOTE = "atenção: plano empresarial com 1 vida (PME costuma exigir 2+; conferir MEI/operadora)";

export function isSingleLifeBusinessPlan(memory: ConversationMemory) {
  return memory.planType?.value === "empresarial" && Number.parseInt(memory.numberOfLives?.value ?? "", 10) === 1;
}

/**
 * Creates the internal context that is persisted with the lead. This is kept
 * separate from the public qualification score so the broker can see the
 * facts captured by the assistant without losing the original conversation
 * memory or fields maintained by other lead intelligence features.
 */
export function buildPrivateQualificationContext(memory: ConversationMemory, updatedAt = new Date()) {
  const facts = [
    memory.planType?.value ? `tipo de plano: ${memory.planType.value}` : null,
    memory.numberOfLives?.value ? `vidas: ${memory.numberOfLives.value}` : null,
    isSingleLifeBusinessPlan(memory) ? PME_SINGLE_LIFE_NOTE : null,
    memory.averageAge?.value ? `média de idade: ${memory.averageAge.value}` : memory.age?.value ? `idades: ${memory.age.value}` : null,
    memory.city?.value ? `cidade: ${memory.city.value}` : null,
    memory.neighborhood?.value ? `bairro: ${memory.neighborhood.value}` : null,
    memory.currentPlan?.value ? `plano atual: ${memory.currentPlan.value}` : null,
    memory.email?.value ? `e-mail: ${memory.email.value}` : null,
    memory.intent?.value ? `interesse: ${memory.intent.value}` : null,
    memory.companyHasCnpj?.value ? `empresa com CNPJ: ${memory.companyHasCnpj.value}` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    source: "ai_qualification",
    summary: facts.length > 0 ? `Contexto capturado pela IA: ${facts.join(" · ")}.` : "A IA ainda não capturou dados estruturados deste atendimento.",
    facts,
    memory,
    updatedAt: updatedAt.toISOString(),
  };
}

/**
 * Lead columns for an evaluation made inside a live AI conversation. Nothing
 * collected yet still means "in qualification": NOT_STARTED/pending would let
 * automatic distribution hand the lead to a broker mid-conversation.
 */
export function qualificationLeadColumns(result: Pick<QualificationEvaluation, "state" | "qualificationStatus">) {
  return result.state === "NOT_STARTED"
    ? { qualificationState: "IN_PROGRESS" as const, qualificationStatus: "qualifying" as const }
    : { qualificationState: result.state, qualificationStatus: result.qualificationStatus };
}

export async function persistQualificationEvaluation(input: {
  tenantId: string;
  leadId: string;
  conversationId: string;
  actorUserId: string | null;
  policy: AgentBehaviorPolicy;
  memory: ConversationMemory;
  reason?: "human_requested" | "not_interested";
}) {
  const result = evaluateQualification(input.memory, input.policy, input.reason);
  const db = getDatabase();
  const now = new Date();
  const [auditActor] = input.actorUserId ? [{ userId: input.actorUserId }] : await db.select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.tenantId, input.tenantId), eq(schema.tenantMemberships.role, "director"), eq(schema.tenantMemberships.status, "active")))
    .limit(1);

  await db.transaction(async (tx) => {
    const [currentLead] = await tx
      .select({ qualificationDetails: schema.leads.qualificationDetails })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)))
      .limit(1);
    const existingDetails = currentLead?.qualificationDetails && typeof currentLead.qualificationDetails === "object" && !Array.isArray(currentLead.qualificationDetails)
      ? currentLead.qualificationDetails as Record<string, unknown>
      : {};
    const privateContext = buildPrivateQualificationContext(input.memory, now);
    const beneficiaryAges = parseAgeValues(input.memory.age?.value);
    const beneficiaries = beneficiariesFromMemory(input.memory, beneficiaryAges);
    const handoffSummary = summarizeQualification(input.memory);
    const existingPrivateNotes = Array.isArray(existingDetails.privateNotes)
      ? existingDetails.privateNotes.filter((note): note is Record<string, unknown> => Boolean(note && typeof note === "object"))
      : [];
    const withoutAiContext = existingPrivateNotes.filter((note) => note.source !== "ai_qualification");

    await tx.update(schema.leads).set({
      ...qualificationLeadColumns(result),
      qualificationScore: result.score,
      qualificationProfileKey: input.policy.qualification.profileKey,
      qualificationCompletedAt: ["QUALIFIED", "PARTIAL", "NOT_INTERESTED"].includes(result.state) ? now : null,
      qualificationDetails: {
        ...existingDetails,
        completedFields: result.completedFields,
        missingFields: result.missingFields,
        profileKey: input.policy.qualification.profileKey,
        classification: result.classification,
        reasons: result.reasons,
        planType: input.memory.planType?.value ?? null,
        numberOfLives: input.memory.numberOfLives?.value ?? null,
        individualAges: input.memory.planType?.value === "empresarial" ? null : input.memory.age?.value ?? null,
        averageAge: input.memory.planType?.value === "empresarial" ? input.memory.averageAge?.value ?? null : null,
        city: input.memory.city?.value ?? null,
        neighborhood: input.memory.neighborhood?.value ?? null,
        currentPlan: input.memory.currentPlan?.value ?? null,
        email: input.memory.email?.value ?? null,
        resumoAtendimento: handoffSummary || existingDetails.resumoAtendimento || null,
        beneficiarios: beneficiaries.map((beneficiary) => ({
          idade: beneficiary.age,
          parentesco: beneficiary.relation,
          texto: beneficiary.relationText ?? (input.memory.beneficiaryRaw || null),
        })),
        ...(input.memory.beneficiaryRaw ? { beneficiaryRaw: input.memory.beneficiaryRaw } : {}),
        // Private, tenant-scoped context used by the broker and by the next
        // qualification turn. Keeping it nested avoids clobbering AI
        // intelligence, manual notes, or other lead details.
        aiQualificationContext: privateContext,
        privateNotes: [...withoutAiContext, privateContext],
      },
      updatedAt: now,
    }).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)));

    if (auditActor?.userId) await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: auditActor.userId,
      entidade: "lead_qualification",
      entidadeId: input.leadId,
      acao: `qualification.${result.state.toLowerCase()}:${result.classification}`,
    });
  });

  // Conversions API for CRM: warm/hot become "Qualificado"/"Quente" (Lead Ads only, never throws).
  await enqueueMetaQualificationConversion({ tenantId: input.tenantId, leadId: input.leadId, qualificationStatus: qualificationLeadColumns(result).qualificationStatus, at: now });

  return result;
}

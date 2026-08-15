import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import type { AgentBehaviorPolicy } from "@/features/agent-training/service";
import type { ConversationMemory } from "@/features/ai-agent/memory";
import { deriveLeadQualificationStatus } from "@/features/leads/qualification-status";
import { getDatabase, schema } from "@/shared/db";

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
};

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
  pastOutboundTexts?: Set<string>
): QualificationQuestionDefinition | null {
  const required = policy?.requiredFields ?? ["customerName", "planType", "numberOfLives", "age", "city", "email"];
  let fallbackQuestion: QualificationQuestionDefinition | null = null;

  for (const field of required) {
    if (field === "age" && memory.planType?.value === "empresarial") {
      if (!memory.averageAge?.value) {
        const qDef = ALL_QUESTIONS_DEFINITIONS[field] ?? null;
        if (qDef) {
          if (!pastOutboundTexts || !pastOutboundTexts.has(qDef.text.trim().toLowerCase())) {
            return qDef;
          }
          if (!fallbackQuestion) fallbackQuestion = qDef;
        }
      }
    } else {
      const memKey = memoryFieldByPolicyField[field];
      const val = memKey ? (memory[memKey] as { value?: string } | undefined)?.value : undefined;
      if (!val || !val.trim()) {
        const qDef = ALL_QUESTIONS_DEFINITIONS[field] ?? null;
        if (qDef) {
          if (!pastOutboundTexts || !pastOutboundTexts.has(qDef.text.trim().toLowerCase())) {
            return qDef;
          }
          if (!fallbackQuestion) fallbackQuestion = qDef;
        }
      }
    }
  }
  return fallbackQuestion;
}

export function resolveDeterministicQualificationTurn(input: {
  memory: ConversationMemory;
  policy: AgentBehaviorPolicy;
  handoffMessage?: string | null;
  pastOutboundTexts?: Set<string>;
}): DeterministicQualificationTurn {
  const evaluation = evaluateQualification(input.memory, input.policy);
  const nextQuestion = getNextQualificationQuestion(input.memory, input.policy, input.pastOutboundTexts);

  if (!nextQuestion) {
    return {
      kind: "handoff",
      reply: input.handoffMessage?.trim() || "Obrigado pelas informações. Vou encaminhar seu atendimento para um corretor da equipe agora.",
      evaluation,
      nextQuestion: null,
    };
  }

  const firstName = input.memory.customerFirstName?.value
    ?? input.memory.customerName?.value?.split(/\s+/)[0];
  const greeting = firstName ? `Perfeito, ${firstName}. ` : "";

  return {
    kind: "collecting",
    reply: `${greeting}${nextQuestion.text}`,
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
    qualificationStatus = "warm";
    classification = "warm";
    reasons.push("Transferência solicitada pelo cliente antes de concluir todas as perguntas");
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
    await tx.update(schema.leads).set({
      qualificationState: result.state,
      qualificationScore: result.score,
      qualificationStatus: result.qualificationStatus,
      qualificationProfileKey: input.policy.qualification.profileKey,
      qualificationCompletedAt: ["QUALIFIED", "PARTIAL", "NOT_INTERESTED"].includes(result.state) ? now : null,
      qualificationDetails: {
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
        email: input.memory.email?.value ?? null,
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

  return result;
}

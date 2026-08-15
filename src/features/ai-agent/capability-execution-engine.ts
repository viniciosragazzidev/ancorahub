import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { AGENT_CAPABILITIES, type AgentCapabilityDefinition, type QualificationFact } from "./capability-registry";
import { runCapabilityGuardPipeline, type GuardContext, type GuardCheckResult } from "./capability-guards";
import { transitionConversationState } from "./conversation-state-machine";

export interface RequestCapabilityInput {
  capabilityKey: string;
  tenantId: string;
  leadId: string;
  contactId?: string;
  conversationId?: string;
  sessionId?: string;
  factUpdates?: Array<{ key: string; value: string; status?: "COLLECTED" | "VALIDATED" | "CONFIRMED" | "CORRECTED" }>;
  actorUserId?: string;
  reason?: string;
  forceExecution?: boolean;
}

export interface AgentExecutionResult {
  success: boolean;
  skipped?: boolean;
  idempotencyKey: string;
  capabilityKey: string;
  guardResult?: GuardCheckResult;
  error?: string;
  executedFacts?: Record<string, string>;
}

export function buildTriggerIdempotencyKey(params: {
  scope: string;
  entityId: string;
  capabilityKey: string;
  sessionId?: string;
  factKey?: string;
}): string {
  const scopeLower = params.scope.toLowerCase();
  const capLower = params.capabilityKey.toLowerCase();
  if (params.sessionId) {
    return `session:${params.sessionId}:${capLower}${params.factKey ? `:${params.factKey}` : ""}`;
  }
  return `${scopeLower}:${params.entityId}:${capLower}${params.factKey ? `:${params.factKey}` : ""}`;
}

export async function requestAgentCapability(input: RequestCapabilityInput): Promise<AgentExecutionResult> {
  const db = getDatabase();
  const now = new Date();

  // 1. Resolver Capability Definition
  const capability = AGENT_CAPABILITIES.find((c) => c.key === input.capabilityKey);
  if (!capability || !capability.enabled) {
    const key = input.capabilityKey;
    return {
      success: false,
      capabilityKey: key,
      idempotencyKey: `failed:${key}`,
      error: `Capacidade [${key}] desativada ou não encontrada no Capability Registry.`,
    };
  }

  // 2. Resolver dados contextuais para os Guards
  const [lead] = await db
    .select({
      id: schema.leads.id,
      tenantId: schema.leads.tenantId,
      corretorId: schema.leads.corretorId,
      status: schema.leads.status,
      qualificationStatus: schema.leads.qualificationStatus,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)))
    .limit(1);

  if (!lead) {
    return {
      success: false,
      capabilityKey: capability.key,
      idempotencyKey: `failed:${capability.key}`,
      error: "Lead não encontrado para o tenant autenticado.",
    };
  }

  let convStatus = "AI_ACTIVE";
  let convOwner: "AI" | "HUMAN" | "AUTOMATION" | "NONE" = "AI";

  if (input.conversationId) {
    const [conv] = await db
      .select({ status: schema.aiConversations.status })
      .from(schema.aiConversations)
      .where(and(eq(schema.aiConversations.id, input.conversationId), eq(schema.aiConversations.tenantId, input.tenantId)))
      .limit(1);

    if (conv) {
      convStatus = conv.status;
      if (conv.status === "HUMAN_ACTIVE" || conv.status === "WAITING_HUMAN") {
        convOwner = "HUMAN";
      }
    }
  }

  // Buscar Fatos conhecidos do Lead nas interações recentes
  const knownFacts: Record<string, string> = {};
  if (input.factUpdates) {
    for (const f of input.factUpdates) {
      knownFacts[f.key] = f.value;
    }
  }

  const guardContext: GuardContext = {
    tenantId: input.tenantId,
    resourceTenantId: lead.tenantId,
    userRole: input.actorUserId ? "manager" : "agent",
    userPermissions: ["acessar_qualificacao_ia", "acessar_conversas", "acessar_leads"],
    conversationOwner: convOwner,
    conversationStatus: convStatus,
    contactOptedOut: lead.qualificationStatus === "cold" && convStatus === "CLOSED",
    knownFacts,
  };

  // 3. Executar Guard Pipeline
  const guardResult = runCapabilityGuardPipeline(capability, guardContext);
  if (!guardResult.allowed) {
    return {
      success: false,
      capabilityKey: capability.key,
      idempotencyKey: `denied:${capability.key}`,
      guardResult,
      error: guardResult.denialReason,
    };
  }

  // 4. Gerar Chave de Idempotência Determinística
  const idempotencyKey = buildTriggerIdempotencyKey({
    scope: capability.executionScope,
    entityId: input.leadId,
    capabilityKey: capability.key,
    sessionId: input.sessionId,
  });

  // 5. Checar Política de Repetição / Idempotência (se ONCE ou ONCE_PER_SESSION)
  if (!input.forceExecution && (capability.repeatPolicy === "ONCE" || capability.repeatPolicy === "ONCE_PER_SESSION")) {
    const existingInteraction = await db
      .select({ id: schema.leadInteractions.id })
      .from(schema.leadInteractions)
      .where(and(eq(schema.leadInteractions.leadId, input.leadId), eq(schema.leadInteractions.tipo, "system_alert")))
      .limit(50);

    const alreadyRun = existingInteraction.some((i) => i.id === idempotencyKey);
    if (alreadyRun) {
      return {
        success: true,
        skipped: true,
        capabilityKey: capability.key,
        idempotencyKey,
        error: `Capacidade [${capability.name}] já executada anteriormente. Ignorando repetição.`,
      };
    }
  }

  // 6. Executar Ação de Domínio
  let targetQualStatus = lead.qualificationStatus;
  let targetStatus = lead.status;
  let isCompleted = false;

  if (capability.key === "TRANSFER_TO_HUMAN") {
    targetQualStatus = "waiting_human";
    targetStatus = "distributed";
  } else if (capability.key === "MARK_OPT_OUT" || capability.key === "MARK_WRONG_NUMBER") {
    targetQualStatus = "cold";
    targetStatus = "distributed";
    isCompleted = true;
  } else if (capability.key === "COMPLETE_QUALIFICATION") {
    targetQualStatus = "hot";
    targetStatus = "distributed";
    isCompleted = true;
  }

  await db.update(schema.leads).set({
    qualificationStatus: targetQualStatus,
    qualificationState: isCompleted ? "QUALIFIED" : "IN_PROGRESS",
    status: targetStatus,
    distributionStatus: isCompleted ? "queued" : "unassigned",
    qualificationCompletedAt: isCompleted ? now : null,
    updatedAt: now,
  }).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)));

  if (input.conversationId) {
    const nextStatus = capability.key === "TRANSFER_TO_HUMAN" ? "WAITING_HUMAN" : isCompleted ? "CLOSED" : "WAITING_CUSTOMER";
    await transitionConversationState({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      newStatus: nextStatus,
      reason: input.reason || `Execução da capacidade [${capability.key}] ${capability.name}`,
    });
  }

  // 7. Salvar Interação e Log de Auditoria
  await db.insert(schema.leadInteractions).values({
    id: randomUUID(),
    leadId: input.leadId,
    userId: input.actorUserId || "system",
    tipo: "system_alert",
    conteudo: `Capacidade [${capability.key}] ${capability.name} executada com sucesso. RiskLevel: ${capability.riskLevel}.`,
  });

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: input.actorUserId || "system",
    entidade: "lead",
    entidadeId: input.leadId,
    acao: `capability_registry.${capability.key.toLowerCase()}`,
  }).catch(() => undefined);

  return {
    success: true,
    capabilityKey: capability.key,
    idempotencyKey,
    executedFacts: knownFacts,
  };
}

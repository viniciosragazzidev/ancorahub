import { AgentCapabilityDefinition } from "./capability-registry";

export interface GuardContext {
  tenantId: string;
  resourceTenantId: string;
  userRole?: string;
  userPermissions?: string[];
  conversationOwner?: "AI" | "HUMAN" | "AUTOMATION" | "NONE";
  conversationStatus?: string;
  contactOptedOut?: boolean;
  knownFacts?: Record<string, string>;
  executionHistory?: Array<{ idempotencyKey: string; status: string }>;
}

export interface GuardCheckResult {
  allowed: boolean;
  deniedGuard?: string;
  denialCode?: string;
  denialReason?: string;
}

export function runTenantGuard(context: GuardContext): GuardCheckResult {
  if (!context.tenantId || !context.resourceTenantId || context.tenantId !== context.resourceTenantId) {
    return {
      allowed: false,
      deniedGuard: "TenantGuard",
      denialCode: "CROSS_TENANT_ACCESS_DENIED",
      denialReason: "Acesso negado: o recurso pertence a outro tenant.",
    };
  }
  return { allowed: true };
}

export function runPermissionGuard(capability: AgentCapabilityDefinition, context: GuardContext): GuardCheckResult {
  if (capability.requiredPermissions.length === 0) return { allowed: true };

  const hasPerm = capability.requiredPermissions.some((perm) =>
    context.userPermissions?.includes(perm) || context.userRole === "director" || context.userRole === "super_admin"
  );

  if (!hasPerm) {
    return {
      allowed: false,
      deniedGuard: "PermissionGuard",
      denialCode: "OUTSIDE_PERMISSION_SCOPE",
      denialReason: `Acesso negado: permissão necessária (${capability.requiredPermissions.join(", ")}) ausente.`,
    };
  }
  return { allowed: true };
}

export function runHumanTakeoverGuard(capability: AgentCapabilityDefinition, context: GuardContext): GuardCheckResult {
  if (context.conversationOwner === "HUMAN" && !capability.canRunWhenHumanActive) {
    return {
      allowed: false,
      deniedGuard: "HumanTakeoverGuard",
      denialCode: "HUMAN_OWNS_CONVERSATION",
      denialReason: "Ação bloqueada: o atendimento foi assumido por um humano.",
    };
  }
  return { allowed: true };
}

export function runOptOutGuard(capability: AgentCapabilityDefinition, context: GuardContext): GuardCheckResult {
  if (context.contactOptedOut && !capability.canRunAfterOptOut) {
    return {
      allowed: false,
      deniedGuard: "OptOutGuard",
      denialCode: "OPTED_OUT_CONTACT",
      denialReason: "Ação bloqueada: o contato solicitou opt-out / descadastramento.",
    };
  }
  return { allowed: true };
}

export function runConversationStateGuard(capability: AgentCapabilityDefinition, context: GuardContext): GuardCheckResult {
  if (!context.conversationStatus) return { allowed: true };

  const stateAllowed = capability.allowedConversationStates.includes(context.conversationStatus);
  if (!stateAllowed) {
    return {
      allowed: false,
      deniedGuard: "ConversationStateGuard",
      denialCode: "INVALID_CONVERSATION_STATE",
      denialReason: `Ação não permitida no estado atual da conversa (${context.conversationStatus}).`,
    };
  }
  return { allowed: true };
}

export function runRequiredFactsGuard(capability: AgentCapabilityDefinition, context: GuardContext): GuardCheckResult {
  if (capability.requiredFacts.length === 0) return { allowed: true };

  const missingFacts = capability.requiredFacts.filter(
    (factKey) => !context.knownFacts?.[factKey] || context.knownFacts[factKey].trim() === ""
  );

  if (missingFacts.length > 0) {
    return {
      allowed: false,
      deniedGuard: "RequiredFactsGuard",
      denialCode: "MISSING_REQUIRED_FACTS",
      denialReason: `Fatos obrigatórios ausentes: ${missingFacts.join(", ")}.`,
    };
  }
  return { allowed: true };
}

export function runCapabilityGuardPipeline(
  capability: AgentCapabilityDefinition,
  context: GuardContext
): GuardCheckResult {
  const guards = [
    () => runTenantGuard(context),
    () => runPermissionGuard(capability, context),
    () => runHumanTakeoverGuard(capability, context),
    () => runOptOutGuard(capability, context),
    () => runConversationStateGuard(capability, context),
    () => runRequiredFactsGuard(capability, context),
  ];

  for (const guard of guards) {
    const result = guard();
    if (!result.allowed) {
      return result;
    }
  }

  return { allowed: true };
}

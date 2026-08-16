import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { transitionConversationState } from "./conversation-state-machine";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { INITIAL_AGENT_TRIGGERS } from "./trigger-registry";

/**
 * Verifica se uma ação/gatilho já foi executada para o lead fornecido
 * para evitar duplicações indevidas ou ações repetidas.
 */
export async function hasTriggerBeenExecuted(tenantId: string, leadId: string, triggerKey: string): Promise<boolean> {
  const db = getDatabase();
  const records = await db
    .select({ id: schema.leadInteractions.id, conteudo: schema.leadInteractions.conteudo })
    .from(schema.leadInteractions)
    .where(and(eq(schema.leadInteractions.leadId, leadId), eq(schema.leadInteractions.tipo, "system_alert")))
    .limit(50);

  return records.some((r) => r.conteudo.includes(`Gatilho [${triggerKey}] executado`));
}

/**
 * Executa um gatilho garantindo auditoria e prevenção contra duplicações.
 */
export async function executeAgentTrigger(params: {
  triggerKey: string;
  tenantId: string;
  leadId: string;
  conversationId?: string | null;
  reason?: string;
  actorUserId?: string | null;
  forceExecution?: boolean;
}) {
  const db = getDatabase();
  const now = new Date();

  const triggerDef = INITIAL_AGENT_TRIGGERS.find((t) => t.key === params.triggerKey || t.id === params.triggerKey);
  if (!triggerDef || !triggerDef.enabled) {
    return { success: false, error: "Gatilho desativado ou não encontrado na loja de triggers." };
  }

  // Checagem de duplicação: Evita repetição da mesma ação para o mesmo lead
  if (!params.forceExecution) {
    const alreadyExecuted = await hasTriggerBeenExecuted(params.tenantId, params.leadId, triggerDef.key);
    if (alreadyExecuted) {
      return { success: false, skipped: true, reason: `Gatilho ${triggerDef.name} já foi executado anteriormente para este lead.` };
    }
  }

  let newQualStatus: "waiting_human" | "hot" | "warm" | "cold" | "qualifying" = "warm";
  const isIntake = triggerDef.category === "intake";

  switch (triggerDef.actionType) {
    case "TRANSFER_HUMAN":
      newQualStatus = "waiting_human";
      break;
    case "TAG_HOT":
      newQualStatus = "hot";
      break;
    case "TAG_WARM":
      newQualStatus = "warm";
      break;
    case "TAG_COLD":
      newQualStatus = "cold";
      break;
    case "TAG_DISQUALIFIED":
      newQualStatus = "cold";
      break;
    default:
      newQualStatus = "warm";
  }

  // Atualizar Lead no banco de dados
  await db.update(schema.leads).set({
    qualificationStatus: isIntake ? "qualifying" : newQualStatus,
    qualificationState: isIntake ? "IN_PROGRESS" : "QUALIFIED",
    status: isIntake ? "new" : "distributed",
    distributionStatus: isIntake ? "unassigned" : "queued",
    qualificationCompletedAt: isIntake ? null : now,
    updatedAt: now,
  }).where(and(eq(schema.leads.id, params.leadId), eq(schema.leads.tenantId, params.tenantId)));

  // Atualizar conversa se houver
  if (params.conversationId) {
    const convStatus = triggerDef.actionType === "TRANSFER_HUMAN" ? "WAITING_HUMAN" : isIntake ? "WAITING_CUSTOMER" : "CLOSED";
    await transitionConversationState({
      tenantId: params.tenantId,
      conversationId: params.conversationId,
      newStatus: convStatus,
      reason: params.reason || `Gatilho [${triggerDef.key}] ${triggerDef.name} executado`,
    });
  }

  // Registrar interação no histórico do lead (registro permanente para deduplicação)
  const resolvedUserId = params.actorUserId || await resolveSystemUserId(params.tenantId);

  await db.insert(schema.leadInteractions).values({
    id: randomUUID(),
    leadId: params.leadId,
    userId: resolvedUserId,
    tipo: "system_alert",
    conteudo: `Gatilho [${triggerDef.key}] executado com sucesso: ${triggerDef.name}.`,
  });

  // Registrar log de auditoria
  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: resolvedUserId,
    entidade: "lead",
    entidadeId: params.leadId,
    acao: `agent_trigger.${triggerDef.key.toLowerCase()}`,
  }).catch(() => undefined);

  return { success: true, trigger: triggerDef };
}

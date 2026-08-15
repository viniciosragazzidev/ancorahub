import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { transitionConversationState } from "./conversation-state-machine";

export type AgentTriggerActionType =
  | "TRANSFER_HUMAN"
  | "TAG_HOT"
  | "TAG_WARM"
  | "TAG_COLD"
  | "TAG_DISQUALIFIED"
  | "WEBHOOK_AUTOMATION"
  | "CUSTOM_ROUTINE";

export interface AgentTriggerItem {
  id: string;
  key: string;
  name: string;
  description: string;
  category: "transfer" | "qualification" | "opt_out" | "question" | "automation";
  actionType: AgentTriggerActionType;
  enabled: boolean;
  keywords: string[];
  webhookUrl?: string;
  updatedAt: string;
}

export const INITIAL_AGENT_TRIGGERS: AgentTriggerItem[] = [
  {
    id: "trg_transfer_human",
    key: "TRANSFER_TO_HUMAN",
    name: "Transferir para Atendente Humano",
    description: "Acionado quando o lead solicita falar com corretor ou atendente humano.",
    category: "transfer",
    actionType: "TRANSFER_HUMAN",
    enabled: true,
    keywords: ["falar com atendente", "corretor", "humano", "falar com pessoa", "urgente", "especialista"],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "trg_qualify_hot",
    key: "QUALIFY_HOT",
    name: "Qualificação Quente (Hot Lead)",
    description: "Acionado quando o lead possui perfil PJ/PME ou urgência imediata de contratação.",
    category: "qualification",
    actionType: "TAG_HOT",
    enabled: true,
    keywords: ["cnpj", "pme", "plano empresarial", "urgencia maxima", "contratar hoje"],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "trg_qualify_warm",
    key: "QUALIFY_WARM",
    name: "Qualificação Morna (Warm Lead)",
    description: "Acionado quando o lead demonstra interesse padrão e responde as perguntas básicas.",
    category: "qualification",
    actionType: "TAG_WARM",
    enabled: true,
    keywords: ["gostaria de cotacao", "valores", "qual o preco", "me mande proposta"],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "trg_opt_out",
    key: "MARK_OPT_OUT",
    name: "Recusa / Sem Interesse (Opt-Out)",
    description: "Acionado quando o lead declara não ter interesse ou pede para cancelar mensagens.",
    category: "opt_out",
    actionType: "TAG_COLD",
    enabled: true,
    keywords: ["nao tenho interesse", "nao quero", "sem interesse", "cancelar", "ja tenho plano"],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "trg_wrong_number",
    key: "MARK_WRONG_NUMBER",
    name: "Número Errado / Engano",
    description: "Acionado quando o número pertence a outra pessoa ou o nome não confere.",
    category: "opt_out",
    actionType: "TAG_DISQUALIFIED",
    enabled: true,
    keywords: ["nao sou", "numero errado", "engano", "pessoa errada", "nao conheco"],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "trg_future_webhook",
    key: "WEBHOOK_AUTOMATION_TEMPLATE",
    name: "Gatilho de Automação Externa (Webhook / CRM)",
    description: "Modelo de gatilho reutilizável para disparar webhooks e automações externas no futuro.",
    category: "automation",
    actionType: "WEBHOOK_AUTOMATION",
    enabled: false,
    keywords: ["integracao externa", "gatilho personalizado"],
    webhookUrl: "https://api.ancorasaude.cloud/webhooks/automation-trigger",
    updatedAt: new Date().toISOString(),
  },
];

export async function executeAgentTrigger(params: {
  triggerKey: string;
  tenantId: string;
  leadId: string;
  conversationId?: string | null;
  reason?: string;
  actorUserId?: string | null;
}) {
  const db = getDatabase();
  const now = new Date();

  const triggerDef = INITIAL_AGENT_TRIGGERS.find((t) => t.key === params.triggerKey || t.id === params.triggerKey);
  if (!triggerDef || !triggerDef.enabled) {
    return { success: false, error: "Gatilho desativado ou não encontrado." };
  }

  let newQualStatus: "waiting_human" | "hot" | "warm" | "cold" | "qualifying" = "warm";
  let isPendingBot = false;

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

  await db.update(schema.leads).set({
    qualificationStatus: newQualStatus,
    qualificationState: isPendingBot ? "IN_PROGRESS" : "QUALIFIED",
    status: isPendingBot ? "new" : "distributed",
    distributionStatus: isPendingBot ? "unassigned" : "queued",
    qualificationCompletedAt: isPendingBot ? null : now,
    updatedAt: now,
  }).where(and(eq(schema.leads.id, params.leadId), eq(schema.leads.tenantId, params.tenantId)));

  if (params.conversationId) {
    const convStatus = triggerDef.actionType === "TRANSFER_HUMAN" ? "WAITING_HUMAN" : "CLOSED";
    await transitionConversationState({
      tenantId: params.tenantId,
      conversationId: params.conversationId,
      newStatus: convStatus,
      reason: params.reason || `Gatilho ${triggerDef.name} acionado`,
    });
  }

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: params.actorUserId || "system",
    entidade: "lead",
    entidadeId: params.leadId,
    acao: `agent_trigger.${triggerDef.key.toLowerCase()}`,
  }).catch(() => undefined);

  return { success: true, trigger: triggerDef };
}

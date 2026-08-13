import "server-only";

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

import { getDatabase, schema } from "@/shared/db";

export type ToolCategory = "read_only" | "low_risk_write" | "medium_risk_write" | "critical";
export type ToolPermissionLevel = "allowed" | "limited" | "rules_required" | "blocked";

export type ToolGovernanceItem = {
  toolName: string;
  displayName: string;
  category: ToolCategory;
  defaultPermission: ToolPermissionLevel;
  description: string;
};

export const SYSTEM_MCP_TOOLS: ToolGovernanceItem[] = [
  // Read Only
  { toolName: "consultar_lead", displayName: "Consultar lead", category: "read_only", defaultPermission: "allowed", description: "Busca dados cadastrais do lead" },
  { toolName: "consultar_historico", displayName: "Consultar histórico", category: "read_only", defaultPermission: "allowed", description: "Ver histórico de mensagens e eventos" },
  { toolName: "consultar_planos", displayName: "Consultar planos", category: "read_only", defaultPermission: "allowed", description: "Consultar catálogo de planos disponíveis" },
  { toolName: "consultar_disponibilidade_corretores", displayName: "Consultar disponibilidade dos corretores", category: "read_only", defaultPermission: "allowed", description: "Verificar se há corretores no plantão" },

  // Low Risk Write
  { toolName: "atualizar_dados_qualificacao", displayName: "Atualizar dados de qualificação", category: "low_risk_write", defaultPermission: "allowed", description: "Salvar vidas, idades, cidade e plano" },
  { toolName: "adicionar_tag", displayName: "Adicionar tag", category: "low_risk_write", defaultPermission: "allowed", description: "Adicionar marcadores de perfil no lead" },
  { toolName: "registrar_nota_ia", displayName: "Registrar nota da IA", category: "low_risk_write", defaultPermission: "allowed", description: "Gravar resumo da conversa" },
  { toolName: "criar_tarefa", displayName: "Criar tarefa", category: "low_risk_write", defaultPermission: "allowed", description: "Agendar lembrete ou retorno" },
  { toolName: "alterar_etapa", displayName: "Alterar etapa", category: "low_risk_write", defaultPermission: "limited", description: "Mover lead no funil conforme regras" },

  // Medium Risk Write
  { toolName: "atribuir_corretor", displayName: "Atribuir corretor", category: "medium_risk_write", defaultPermission: "rules_required", description: "Encaminhar lead para um corretor específico" },
  { toolName: "transferir_unidade", displayName: "Transferir unidade", category: "medium_risk_write", defaultPermission: "rules_required", description: "Encaminhar lead para outra filial" },
  { toolName: "solicitar_documentos", displayName: "Solicitar documentos", category: "medium_risk_write", defaultPermission: "allowed", description: "Enviar lista de documentos necessários" },

  // Critical (Always Blocked for AI execution)
  { toolName: "confirmar_venda", displayName: "Confirmar venda", category: "critical", defaultPermission: "blocked", description: "Finalizar contrato comercial" },
  { toolName: "gerar_comissao", displayName: "Gerar comissão", category: "critical", defaultPermission: "blocked", description: "Lançar comissionamento financeiro" },
  { toolName: "aprovar_documentos", displayName: "Aprovar documentos", category: "critical", defaultPermission: "blocked", description: "Validação jurídica de documentos" },
  { toolName: "excluir_lead", displayName: "Excluir lead", category: "critical", defaultPermission: "blocked", description: "Remover registro do banco" },
  { toolName: "alterar_permissoes", displayName: "Alterar permissões", category: "critical", defaultPermission: "blocked", description: "Modificar acessos de usuários" },
  { toolName: "alterar_valores_cotacao", displayName: "Alterar valores de cotação", category: "critical", defaultPermission: "blocked", description: "Alterar tabela de preços oficial" },
  { toolName: "disparar_campanha_massa", displayName: "Disparar campanha em massa", category: "critical", defaultPermission: "blocked", description: "Envios em lote para lista" },
];

export const ALLOWED_STAGE_TRANSITIONS = {
  allowed: [
    { from: "Novo", to: "Em qualificação" },
    { from: "Em qualificação", to: "Qualificado" },
    { from: "Em qualificação", to: "Não qualificado" },
    { from: "Qualificado", to: "Aguardando corretor" },
  ],
  blocked: [
    { from: "Qualificado", to: "Venda concluída" },
    { from: "Venda concluída", to: "Cancelado" },
  ],
};

export const updateToolPermissionSchema = z.object({
  toolName: z.string(),
  permission: z.enum(["allowed", "limited", "rules_required", "blocked"]),
  maxCallsPerSession: z.number().int().min(1).max(50).default(10),
  requiresHumanConfirmation: z.boolean().default(false),
});

export type UpdateToolPermissionInput = z.infer<typeof updateToolPermissionSchema>;

export async function getToolPermissions(tenantId: string) {
  const db = getDatabase();
  let dbPermissions: any[] = [];
  try {
    dbPermissions = await db
      .select()
      .from(schema.aiQualificationToolPermissions)
      .where(eq(schema.aiQualificationToolPermissions.tenantId, tenantId));
  } catch (err) {
    console.error("[tool-governance] Error querying tool permissions:", err);
  }

  const permMap = new Map(dbPermissions.map((p) => [p.toolName, p]));

  return SYSTEM_MCP_TOOLS.map((tool) => {
    const existing = permMap.get(tool.toolName);
    return {
      toolName: tool.toolName,
      displayName: tool.displayName,
      category: tool.category,
      description: tool.description,
      permission: existing ? (existing.permission as ToolPermissionLevel) : tool.defaultPermission,
      maxCallsPerSession: existing?.maxCallsPerSession ?? 10,
      requiresHumanConfirmation: existing?.requiresHumanConfirmation ?? (tool.category === "critical"),
      isCritical: tool.category === "critical",
    };
  });
}

export async function updateToolPermission(
  tenantId: string,
  actorUserId: string,
  input: UpdateToolPermissionInput
) {
  const data = updateToolPermissionSchema.parse(input);
  const toolDef = SYSTEM_MCP_TOOLS.find((t) => t.toolName === data.toolName);

  if (!toolDef) {
    throw new Error(`Ferramenta desconhecida: ${data.toolName}`);
  }

  // Enforce critical tool block
  if (toolDef.category === "critical" && data.permission !== "blocked") {
    throw new Error("Ações críticas da IA não podem ser desbloqueadas. Requerem intervenção humana.");
  }

  const db = getDatabase();
  const now = new Date();

  await db
    .insert(schema.aiQualificationToolPermissions)
    .values({
      id: randomUUID(),
      tenantId,
      toolName: data.toolName,
      category: toolDef.category,
      permission: data.permission,
      maxCallsPerSession: data.maxCallsPerSession,
      requiresHumanConfirmation: data.requiresHumanConfirmation,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        schema.aiQualificationToolPermissions.tenantId,
        schema.aiQualificationToolPermissions.toolName,
      ],
      set: {
        permission: data.permission,
        maxCallsPerSession: data.maxCallsPerSession,
        requiresHumanConfirmation: data.requiresHumanConfirmation,
        updatedAt: now,
      },
    });

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: actorUserId,
    entidade: "ai_tool_permission",
    entidadeId: `${tenantId}:${data.toolName}`,
    acao: `tool_permission.updated:${data.toolName}:${data.permission}`,
  });

  return getToolPermissions(tenantId);
}

/** Validate whether a stage transition is allowed for the AI */
export function isStageTransitionAllowed(fromStage: string, toStage: string): boolean {
  const isExplicitlyAllowed = ALLOWED_STAGE_TRANSITIONS.allowed.some(
    (t) => t.from.toLowerCase() === fromStage.toLowerCase() && t.to.toLowerCase() === toStage.toLowerCase()
  );
  if (isExplicitlyAllowed) return true;

  const isExplicitlyBlocked = ALLOWED_STAGE_TRANSITIONS.blocked.some(
    (t) => t.from.toLowerCase() === fromStage.toLowerCase() && t.to.toLowerCase() === toStage.toLowerCase()
  );
  if (isExplicitlyBlocked) return false;

  return false;
}

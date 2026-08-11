import { z } from "zod";
import { getDatabase, schema } from "@/shared/db";
import { and, eq, count, sql, desc } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { assignLeadToBroker } from "@/features/lead-distribution/service";
import { getQualificationAlerts } from "@/features/ai-qualification/alerts-service";

// ─── MCP Tool Registry & Types ───────────────────────────────────────────────

export type McpToolDefinition = {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  allowedRoles: Array<TenantContext["role"]>;
  execute: (input: any, context: TenantContext) => Promise<any>;
};

// ─── 1. Corretor Tools ──────────────────────────────────────────────────────

export const getMyLeadQueueTool: McpToolDefinition = {
  name: "get_my_lead_queue",
  description: "Obtém os leads pendentes de atendimento na fila individual do corretor logado.",
  parameters: z.object({
    limit: z.number().int().min(1).max(20).default(5),
  }),
  allowedRoles: ["broker", "supervisor", "manager", "director"],
  execute: async ({ limit }, context) => {
    const db = getDatabase();
    const leads = await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        status: schema.leads.status,
        qualificationStatus: schema.leads.qualificationStatus,
        createdAt: schema.leads.createdAt,
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          eq(schema.leads.corretorId, context.userId),
          sql`${schema.leads.status} NOT IN ('converted', 'lost')`
        )
      )
      .orderBy(desc(schema.leads.createdAt))
      .limit(limit);

    return {
      totalFound: leads.length,
      leads,
    };
  },
};

export const getMyDutyStatusTool: McpToolDefinition = {
  name: "get_my_duty_status",
  description: "Verifica se o corretor logado está disponível no plantão de atendimento ao vivo.",
  parameters: z.object({}),
  allowedRoles: ["broker", "supervisor", "manager", "director"],
  execute: async (_, context) => {
    const db = getDatabase();
    const [membership] = await db
      .select({
        userId: schema.tenantMemberships.userId,
        role: schema.tenantMemberships.role,
        availabilityStatus: schema.tenantMemberships.availabilityStatus,
        status: schema.tenantMemberships.status,
      })
      .from(schema.tenantMemberships)
      .where(
        and(
          eq(schema.tenantMemberships.userId, context.userId),
          eq(schema.tenantMemberships.tenantId, context.tenantId)
        )
      )
      .limit(1);

    return {
      userId: context.userId,
      onDuty: membership?.availabilityStatus === "available",
      availabilityStatus: membership?.availabilityStatus ?? "offline",
      status: membership?.status ?? "inactive",
    };
  },
};

export const toggleMyDutyStatusTool: McpToolDefinition = {
  name: "toggle_my_duty_status",
  description: "Ativa ou desativa o plantão de atendimento ao vivo do próprio corretor logado.",
  parameters: z.object({
    onDuty: z.boolean(),
  }),
  allowedRoles: ["broker", "supervisor", "manager", "director"],
  execute: async ({ onDuty }, context) => {
    const db = getDatabase();
    const newStatus = onDuty ? "available" : "offline";

    await db
      .update(schema.tenantMemberships)
      .set({
        availabilityStatus: newStatus,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.tenantMemberships.userId, context.userId),
          eq(schema.tenantMemberships.tenantId, context.tenantId)
        )
      );

    return {
      success: true,
      onDuty,
      availabilityStatus: newStatus,
      message: onDuty ? "Você entrou no plantão ao vivo com sucesso." : "Você saiu do plantão ao vivo.",
    };
  },
};

// ─── 2. Supervisor Tools ────────────────────────────────────────────────────

export const getBranchQueueSummaryTool: McpToolDefinition = {
  name: "get_branch_queue_summary",
  description: "Obtém o resumo da fila de atendimento e estouro de SLA da filial ou equipe do supervisor.",
  parameters: z.object({
    branchId: z.string().optional(),
  }),
  allowedRoles: ["supervisor", "manager", "director"],
  execute: async ({ branchId }, context) => {
    const db = getDatabase();
    const targetBranch = branchId || context.branchId;

    const conditions = [eq(schema.leads.tenantId, context.tenantId)];
    if (targetBranch) {
      conditions.push(eq(schema.leads.branchId, targetBranch));
    }

    const leads = await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        status: schema.leads.status,
        qualificationStatus: schema.leads.qualificationStatus,
        corretorId: schema.leads.corretorId,
        createdAt: schema.leads.createdAt,
      })
      .from(schema.leads)
      .where(and(...conditions))
      .orderBy(desc(schema.leads.createdAt))
      .limit(50);

    const totalLeads = leads.length;
    const unassigned = leads.filter((l) => !l.corretorId).length;
    const hotLeads = leads.filter((l) => l.qualificationStatus === "hot").length;

    // SLA breach heuristic (> 15 min sem atribuição)
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const slaBreaches = leads.filter((l) => !l.corretorId && new Date(l.createdAt) < fifteenMinAgo);

    return {
      targetBranchId: targetBranch || "Todas as Filiais",
      totalRecentLeads: totalLeads,
      unassignedCount: unassigned,
      hotLeadsCount: hotLeads,
      slaBreachesCount: slaBreaches.length,
      slaBreaches: slaBreaches.map((l) => ({ id: l.id, nome: l.nome, createdAt: l.createdAt })),
    };
  },
};

export const getBranchOnDutyBrokersTool: McpToolDefinition = {
  name: "get_branch_on_duty_brokers",
  description: "Lista os corretores que estão atualmente em plantão de atendimento ao vivo.",
  parameters: z.object({}),
  allowedRoles: ["supervisor", "manager", "director"],
  execute: async (_, context) => {
    const db = getDatabase();
    const brokers = await db
      .select({
        userId: schema.tenantMemberships.userId,
        role: schema.tenantMemberships.role,
        branchId: schema.tenantMemberships.branchId,
        availabilityStatus: schema.tenantMemberships.availabilityStatus,
      })
      .from(schema.tenantMemberships)
      .where(
        and(
          eq(schema.tenantMemberships.tenantId, context.tenantId),
          eq(schema.tenantMemberships.role, "broker"),
          eq(schema.tenantMemberships.status, "active"),
          eq(schema.tenantMemberships.availabilityStatus, "available")
        )
      );

    return {
      onDutyCount: brokers.length,
      brokers,
    };
  },
};

export const executeLeadReassignmentTool: McpToolDefinition = {
  name: "execute_lead_reassignment",
  description: "Reatribui um lead específico para outro corretor da equipe.",
  parameters: z.object({
    leadId: z.string().uuid(),
    targetBrokerId: z.string().uuid(),
    reason: z.string().min(3).optional(),
  }),
  allowedRoles: ["supervisor", "manager", "director"],
  execute: async ({ leadId, targetBrokerId, reason }, context) => {
    const strategy = context.role === "director" ? "manual_director" : "manual_manager";
    const result = await assignLeadToBroker(
      context,
      leadId,
      targetBrokerId,
      strategy,
      reason || "Reatribuição via Agente IA"
    );

    return {
      success: true,
      leadId,
      newBrokerId: targetBrokerId,
      status: result.status,
      message: "Lead reatribuído com sucesso.",
    };
  },
};

// ─── 3. Gestor & Diretor Tools ──────────────────────────────────────────────

export const getTenantFunnelMetricsTool: McpToolDefinition = {
  name: "get_tenant_funnel_metrics",
  description: "Obtém as métricas gerais do funil de vendas, taxa de conversão e volume de propostas da corretora.",
  parameters: z.object({}),
  allowedRoles: ["manager", "director"],
  execute: async (_, context) => {
    const db = getDatabase();

    const [leadStats] = await db
      .select({
        total: count(schema.leads.id),
        novos: count(sql`CASE WHEN ${schema.leads.status} = 'new' THEN 1 END`),
        qualificados: count(sql`CASE WHEN ${schema.leads.qualificationStatus} = 'hot' THEN 1 END`),
        vendas: count(sql`CASE WHEN ${schema.leads.status} = 'converted' THEN 1 END`),
      })
      .from(schema.leads)
      .where(eq(schema.leads.tenantId, context.tenantId));

    const totalLeads = Number(leadStats?.total ?? 0);
    const totalVendas = Number(leadStats?.vendas ?? 0);
    const taxaConversao = totalLeads > 0 ? ((totalVendas / totalLeads) * 100).toFixed(1) : "0.0";

    return {
      totalLeads,
      novosLeads: Number(leadStats?.novos ?? 0),
      qualificadosHot: Number(leadStats?.qualificados ?? 0),
      vendasRealizadas: totalVendas,
      taxaConversaoGlobal: `${taxaConversao}%`,
    };
  },
};

export const getAiSystemHealthTool: McpToolDefinition = {
  name: "get_ai_system_health",
  description: "Mapeia o status de funcionamento da IA, conexões do WhatsApp e alertas operacionais.",
  parameters: z.object({}),
  allowedRoles: ["manager", "director"],
  execute: async (_, context) => {
    const alerts = await getQualificationAlerts(context.tenantId);
    return {
      tenantId: context.tenantId,
      activeAlertsCount: alerts.length,
      alerts: alerts.map((a) => ({
        id: a.id,
        level: a.level,
        message: a.message,
        suggestedAction: a.suggestedAction,
      })),
    };
  },
};

// ─── All MCP Tools Registry ─────────────────────────────────────────────────

export const ALL_MCP_TOOLS: McpToolDefinition[] = [
  getMyLeadQueueTool,
  getMyDutyStatusTool,
  toggleMyDutyStatusTool,
  getBranchQueueSummaryTool,
  getBranchOnDutyBrokersTool,
  executeLeadReassignmentTool,
  getTenantFunnelMetricsTool,
  getAiSystemHealthTool,
];

export function getMcpToolsForRole(role: TenantContext["role"]): McpToolDefinition[] {
  return ALL_MCP_TOOLS.filter((tool) => tool.allowedRoles.includes(role));
}

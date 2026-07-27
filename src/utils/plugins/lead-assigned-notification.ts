import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { publishNotification } from "@/features/notifications/send-push-helper";
import { isNotificationCapabilityEnabled } from "@/features/notifications/queries";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { hasCapability } from "@/shared/auth/permissions";
import type { PluginContext } from "@/platform/plugins/types";
import type { PluginChannel, PluginExecutionResult, ServerPluginDefinition } from "./contracts";

export const LEAD_ASSIGNED_NOTIFICATION_PLUGIN_ID = "lead.assigned.notify" as const;
export const LEAD_ASSIGNED_NOTIFICATION_FEATURE_FLAG = "plugin.lead-assigned-notify.enabled" as const;

const inputSchema = z.object({
  leadId: z.string().uuid(),
  channels: z.array(z.enum(["push", "whatsapp"])).min(1).max(2).default(["push", "whatsapp"]),
  idempotencyKey: z.string().trim().min(8).max(160).optional(),
});

export type LeadAssignedNotificationInput = z.infer<typeof inputSchema>;

function channelList(value: readonly PluginChannel[]) {
  return [...new Set(value)] as PluginChannel[];
}

async function assertLeadScope(context: Pick<PluginContext, "role" | "userId" | "branchId" | "jobTitle">, lead: { corretorId: string | null; branchId: string | null }) {
  if (context.role === "broker" && lead.corretorId !== context.userId) throw new Error("Você só pode notificar leads da sua carteira.");
  if (context.role === "manager" && (!context.branchId || lead.branchId !== context.branchId)) throw new Error("Você só pode notificar leads da sua unidade.");
  if (!hasCapability(context.role, "acessar_notificacoes", context.jobTitle)) throw new Error("Seu perfil não pode executar notificações.");
}

export const leadAssignedNotificationPlugin: ServerPluginDefinition<{
  context: PluginContext;
  input: LeadAssignedNotificationInput;
}> = {
  manifest: {
    id: LEAD_ASSIGNED_NOTIFICATION_PLUGIN_ID,
    name: "Aviso de lead atribuído",
    description: "Entrega o aviso de um lead ao corretor por push e/ou WhatsApp.",
    category: "lead",
    icon: "bell",
    requiredPermissions: ["acessar_notificacoes"],
    featureFlag: LEAD_ASSIGNED_NOTIFICATION_FEATURE_FLAG,
    minSize: { width: 280, height: 120 },
    preferredSize: { width: 360, height: 180 },
    allowedHosts: ["page", "workspace", "drawer", "dialog", "panel", "widget"],
    eventsPublished: [],
    eventsConsumed: ["lead.assigned"],
  },
  isReady: true,
  isAllowed: (context) => hasCapability(context.role, "acessar_notificacoes", context.jobTitle),
  async execute({ context, input }) {
    const db = getDatabase();
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");

    const [lead] = await db.select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      tipo: schema.leads.tipo,
      branchId: schema.leads.branchId,
      corretorId: schema.leads.corretorId,
    }).from(schema.leads).where(and(eq(schema.leads.id, parsed.data.leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
    if (!lead) throw new Error("Lead não encontrado.");
    await assertLeadScope(context, lead);
    if (!lead.corretorId) throw new Error("O lead ainda não possui corretor responsável.");

    const featureEnabled = (await getSystemSetting(LEAD_ASSIGNED_NOTIFICATION_FEATURE_FLAG)) !== "false";
    if (!featureEnabled || !(await isNotificationCapabilityEnabled("lead_assignment"))) {
      throw new Error("O plugin de aviso de lead está desativado pelo administrador.");
    }

    const executionKey = parsed.data.idempotencyKey ?? `${LEAD_ASSIGNED_NOTIFICATION_PLUGIN_ID}:${context.tenantId}:${lead.id}:${lead.corretorId}`;
    const [completed] = await db.select({ id: schema.auditLogs.id }).from(schema.auditLogs).where(and(
      eq(schema.auditLogs.entidade, "plugin_execution"),
      eq(schema.auditLogs.entidadeId, executionKey),
      eq(schema.auditLogs.acao, "plugin.executed"),
    )).limit(1);
    if (completed) return { pluginId: LEAD_ASSIGNED_NOTIFICATION_PLUGIN_ID, executed: false, duplicate: true, channels: [], warnings: [] };

    const [broker] = await db.select({
      id: schema.user.id,
      name: schema.user.name,
      phone: schema.brokerProfiles.phone,
    }).from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .leftJoin(schema.brokerProfiles, eq(schema.brokerProfiles.userId, schema.user.id))
      .where(and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        eq(schema.tenantMemberships.userId, lead.corretorId),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
        eq(schema.user.active, true),
        eq(schema.user.status, "active"),
      )).limit(1);
    if (!broker) throw new Error("Corretor responsável não encontrado ou inativo.");

    const [tenant] = await db.select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1);
    const [branch] = lead.branchId ? await db.select({ name: schema.branches.name }).from(schema.branches).where(eq(schema.branches.id, lead.branchId)).limit(1) : [];
    const leadType = lead.tipo === "pme" ? "PME" : lead.tipo === "pj" ? "Empresarial" : "Pessoa Física";
    const requestedChannels = channelList(parsed.data.channels);
    const delivered: PluginChannel[] = [];
    const warnings: string[] = [];

    if (requestedChannels.includes("push")) {
      const sent = await publishNotification({
        capability: "lead_assignment",
        tenantId: context.tenantId,
        recipientUserId: broker.id,
        leadId: lead.id,
        type: "agent.lead_assigned",
        title: "Novo lead atribuído",
        message: `Você recebeu o lead ${lead.nome} para atender.`,
        pushTitle: "Novo lead atribuído",
        pushBody: `O lead ${lead.nome} foi distribuído para você.`,
        url: `/leads/${lead.id}`,
        tag: `lead-${lead.id}`,
      });
      if (sent) delivered.push("push"); else warnings.push("O push está desativado ou não possui inscrição ativa.");
    }

    if (requestedChannels.includes("whatsapp")) {
      if (!broker.phone) {
        warnings.push("O corretor não possui telefone cadastrado.");
      } else {
        try {
          await enqueueMetaTemplateMessage({
            tenantId: context.tenantId,
            recipientType: "user",
            recipientId: broker.id,
            destinationPhone: broker.phone,
            purpose: "newLeadAssignment",
            variables: [broker.name ?? "Corretor(a)", tenant?.name ?? "CorreTop", leadType, branch?.name ?? "Unidade Principal", "3", lead.id],
            requestedBy: context.userId,
            idempotencyKey: `${executionKey}:whatsapp`,
          });
          await processMetaOutboundBatch(10, context.tenantId);
          delivered.push("whatsapp");
        } catch (error) {
          warnings.push(error instanceof Error ? error.message : "Não foi possível enfileirar o WhatsApp.");
        }
      }
    }

    if (!delivered.length) throw new Error(warnings[0] ?? "Nenhum canal de notificação foi concluído.");
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "plugin_execution", entidadeId: executionKey, acao: "plugin.executed" });
    return { pluginId: LEAD_ASSIGNED_NOTIFICATION_PLUGIN_ID, executed: true, channels: delivered, warnings };
  },
};

export async function executeLeadAssignedNotification(input: LeadAssignedNotificationInput): Promise<PluginExecutionResult> {
  const context = await getRequiredTenantContext();
  return leadAssignedNotificationPlugin.execute({ context, input });
}

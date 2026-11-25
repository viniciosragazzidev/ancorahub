import "server-only";

/**
 * Consultas da área de funil de /leads (25/11/2026): último contato do lead, próximo retorno marcado, filtro "Com
 * tarefa atrasada" e a lista do radar "Esfriando". Sempre com o escopo de /leads (`buildLeadScopeWhere`): diretor vê a
 * empresa, gestor a unidade, supervisor a equipe e corretor só os dele. Regra de nível em `cooling-radar.ts`.
 */
import { and, asc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { COOLING_RULE, COOLING_WATCH_STATUSES } from "./cooling-radar";
import { buildLeadScopeWhere } from "./lead-authorization";

/** Teto da visão: o radar mostra os mais esquecidos primeiro, então 200 cobre o dia de qualquer equipe. */
export const COOLING_LIST_LIMIT = 200;

/** Última mensagem do lead (qualquer direção) ou o 1º contato, o que for mais recente. */
export const leadLastContactAtSql = sql<Date | null>`greatest(${schema.leads.firstContactAt}, (select max(${schema.whatsappMessages.sentAt}) from ${schema.whatsappMessages} where ${schema.whatsappMessages.tenantId} = ${schema.leads.tenantId} and ${schema.whatsappMessages.leadId} = ${schema.leads.id}))`.mapWith(schema.leads.firstContactAt);

/** Prazo da próxima tarefa aberta no futuro (o retorno marcado). */
export const leadNextOpenTaskDueAtSql = sql<Date | null>`(select min(${schema.leadTasks.dueAt}) from ${schema.leadTasks} where ${schema.leadTasks.tenantId} = ${schema.leads.tenantId} and ${schema.leadTasks.leadId} = ${schema.leads.id} and ${schema.leadTasks.completedAt} is null and ${schema.leadTasks.dueAt} > now())`.mapWith(schema.leadTasks.dueAt);

/** Filtro "Com tarefa atrasada" (?tarefa=atrasada): tarefa aberta com prazo já passado. */
export function overdueTaskLeadFilter(): SQL {
  return sql`exists (select 1 from ${schema.leadTasks} where ${schema.leadTasks.tenantId} = ${schema.leads.tenantId} and ${schema.leadTasks.leadId} = ${schema.leads.id} and ${schema.leadTasks.completedAt} is null and ${schema.leadTasks.dueAt} < now())`;
}

export const OVERDUE_TASK_PARAM = "tarefa";
export const OVERDUE_TASK_VALUE = "atrasada";

/** Atividade mais recente: contato, entrada na etapa ou atribuição (a mesma régua de `lastActivityMs`). */
const lastActivitySql = sql`greatest(${leadLastContactAtSql}, ${schema.leads.stageEnteredAt}, ${schema.leads.assignedAt}, ${schema.leads.createdAt})`;

export type CoolingWhereOptions = {
  requestedBranchId?: string | null;
  /** Os outros filtros da tela (busca, fila, corretor...), já montados pela página. */
  extra?: SQL | null;
};

/** Leads abertos, no escopo de quem vê, parados há pelo menos 1 dia. O nível fino fica na regra pura. */
export function buildCoolingLeadsWhere(context: TenantContext, options: CoolingWhereOptions = {}): SQL {
  return and(
    buildLeadScopeWhere(context, { requestedBranchId: options.requestedBranchId }),
    isNull(schema.leads.deletedAt),
    isNull(schema.leads.archivedAt),
    inArray(schema.leads.status, [...COOLING_WATCH_STATUSES]),
    sql`${lastActivitySql} < now() - (${COOLING_RULE.atRiskAfterDays} * interval '1 day')`,
    ...(options.extra ? [options.extra] : []),
  )!;
}

export async function listCoolingLeads(context: TenantContext, options: CoolingWhereOptions = {}) {
  return getDatabase()
    .select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      telefone: schema.leads.telefone,
      email: schema.leads.email,
      status: schema.leads.status,
      qualificationStatus: schema.leads.qualificationStatus,
      qualificationState: schema.leads.qualificationState,
      distributionStatus: schema.leads.distributionStatus,
      distributionRemovalReason: schema.leads.distributionRemovalReason,
      distributionRemovalNote: schema.leads.distributionRemovalNote,
      origem: schema.leads.origem,
      sourceChannel: schema.leads.sourceChannel,
      sourceCampaign: schema.leads.sourceCampaign,
      sourceMetadata: schema.leads.sourceMetadata,
      tipo: schema.leads.tipo,
      createdAt: schema.leads.createdAt,
      assignedAt: schema.leads.assignedAt,
      stageEnteredAt: schema.leads.stageEnteredAt,
      serviceStartedAt: schema.leads.serviceStartedAt,
      firstContactAt: schema.leads.firstContactAt,
      corretorId: schema.leads.corretorId,
      corretorNome: schema.user.name,
      branchId: schema.leads.branchId,
      branchName: schema.branches.name,
      qualificationDetails: schema.leads.qualificationDetails,
      monthlyValue: schema.leads.monthlyValue,
      livesCount: schema.leads.livesCount,
      queueId: schema.leads.queueId,
      queueName: schema.leadQueues.name,
      queueColorHue: schema.leadQueues.colorHue,
      lastContactAt: leadLastContactAtSql,
      nextOpenTaskDueAt: leadNextOpenTaskDueAtSql,
    })
    .from(schema.leads)
    .leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id))
    .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
    .leftJoin(schema.leadQueues, eq(schema.leads.queueId, schema.leadQueues.id))
    // Os filtros da página podem ler o SLA da empresa (corretor no modo normal).
    .leftJoin(schema.tenants, eq(schema.leads.tenantId, schema.tenants.id))
    .where(buildCoolingLeadsWhere(context, options))
    .orderBy(asc(lastActivitySql))
    .limit(COOLING_LIST_LIMIT);
}

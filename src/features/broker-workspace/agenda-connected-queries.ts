import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { buildClientScopeWhere } from "@/features/customers/customer-authorization";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { classifyAgendaKind, type AgendaEntry } from "./agenda-connected";

/** Teto de leitura da página: os prazos mais próximos primeiro, sem prazo por último. */
export const AGENDA_CONNECTED_LIMIT = 100;

/**
 * Tarefas abertas do corretor (retornos, tarefas e acompanhamentos de renovação) com o nome do lead
 * e o cliente vinculado que ele pode abrir. Tenant e corretor vêm só do contexto da sessão; o perfil
 * só aparece quando o cliente passa pelo mesmo escopo da carteira (`buildClientScopeWhere`).
 */
export async function getBrokerAgendaEntries(context: TenantContext): Promise<AgendaEntry[]> {
  if (context.role !== "broker") throw new Error("A Agenda conectada é do corretor.");
  const rows = await getDatabase()
    .select({
      id: schema.leadTasks.id,
      leadId: schema.leadTasks.leadId,
      title: schema.leadTasks.title,
      dueAt: schema.leadTasks.dueAt,
      priority: schema.leadTasks.priority,
      leadName: schema.leads.nome,
      clientId: schema.clients.id,
      renewalReminderId: schema.customerRenewalReminders.id,
    })
    .from(schema.leadTasks)
    .innerJoin(schema.leads, and(
      eq(schema.leads.id, schema.leadTasks.leadId),
      eq(schema.leads.tenantId, context.tenantId),
      isNull(schema.leads.deletedAt),
    ))
    .leftJoin(schema.clients, and(eq(schema.clients.leadId, schema.leadTasks.leadId), buildClientScopeWhere(context)))
    .leftJoin(schema.customerRenewalReminders, and(
      eq(schema.customerRenewalReminders.taskCreatedId, schema.leadTasks.id),
      eq(schema.customerRenewalReminders.tenantId, context.tenantId),
    ))
    .where(and(
      eq(schema.leadTasks.tenantId, context.tenantId),
      eq(schema.leadTasks.assignedTo, context.userId),
      isNull(schema.leadTasks.completedAt),
    ))
    .orderBy(sql`${schema.leadTasks.dueAt} asc nulls last`, desc(schema.leadTasks.createdAt))
    .limit(AGENDA_CONNECTED_LIMIT);

  const seen = new Set<string>();
  const entries: AgendaEntry[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    entries.push({
      id: row.id,
      leadId: row.leadId,
      leadName: row.leadName,
      title: row.title,
      dueAt: row.dueAt,
      priority: row.priority as AgendaEntry["priority"],
      kind: classifyAgendaKind(row.title, row.renewalReminderId !== null),
      clientId: row.clientId,
    });
  }
  return entries;
}

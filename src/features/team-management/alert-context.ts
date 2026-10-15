import "server-only";

import { and, asc, eq, gt, inArray, isNull, lte, max, or, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import type { OnDutyBroker } from "./alerts";
import { saoPauloDayKey } from "./health-input";

/** Lead mais crítico de um corretor, para o atalho "Abrir lead" do alerta. */
export type CriticalLead = { leadId: string; leadName: string };

export type TeamAlertContext = {
  /** Plantão de hoje (roster ou ocorrência publicada) de cada corretor, com o último aceite. */
  onDuty: OnDutyBroker[];
  /** brokerId -> lead mais crítico: retorno vencido mais antigo; sem ele, o lead ativo parado há mais tempo. */
  criticalLeads: Map<string, CriticalLead>;
};

const ACTIVE_STATUSES = ["distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;

/**
 * Fontes que os alertas precisam e que as janelas do G0 não trazem: início do turno e último aceite,
 * e o lead mais crítico. Só para os corretores que o G0 já devolveu no escopo do viewer.
 */
export async function getTeamAlertContext(context: TenantContext, brokerIds: readonly string[], now: Date): Promise<TeamAlertContext> {
  if (brokerIds.length === 0) return { onDuty: [], criticalLeads: new Map() };
  const db = getDatabase();
  const today = saoPauloDayKey(now);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();

  const [dutyRows, acceptRows, overdueRows, activeRows] = await Promise.all([
    db.select({ brokerId: schema.dutyRosterAssignments.brokerId, startsAt: schema.dutyRosterAssignments.startsAt, name: schema.user.name })
      .from(schema.dutyRosterAssignments)
      .innerJoin(schema.user, eq(schema.user.id, schema.dutyRosterAssignments.brokerId))
      .where(and(
        eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
        inArray(schema.dutyRosterAssignments.brokerId, [...brokerIds]),
        eq(schema.dutyRosterAssignments.status, "active"),
        isNull(schema.dutyRosterAssignments.pausedAt),
        or(
          eq(schema.dutyRosterAssignments.dutyDate, today),
          and(
            isNull(schema.dutyRosterAssignments.dutyDate),
            eq(schema.dutyRosterAssignments.dayOfWeek, weekday),
            lte(schema.dutyRosterAssignments.validFrom, now),
            or(isNull(schema.dutyRosterAssignments.validUntil), gt(schema.dutyRosterAssignments.validUntil, now)),
          ),
        ),
      )),
    db.select({ brokerId: schema.leadOffers.brokerId, lastAcceptedAt: max(schema.leadOffers.acceptedAt) })
      .from(schema.leadOffers)
      .where(and(
        eq(schema.leadOffers.tenantId, context.tenantId),
        inArray(schema.leadOffers.brokerId, [...brokerIds]),
        eq(schema.leadOffers.status, "ACCEPTED"),
      ))
      .groupBy(schema.leadOffers.brokerId),
    db.select({ brokerId: schema.leadTasks.assignedTo, leadId: schema.leads.id, leadName: schema.leads.nome })
      .from(schema.leadTasks)
      .innerJoin(schema.leads, and(eq(schema.leads.id, schema.leadTasks.leadId), eq(schema.leads.tenantId, context.tenantId)))
      .where(and(
        eq(schema.leadTasks.tenantId, context.tenantId),
        inArray(schema.leadTasks.assignedTo, [...brokerIds]),
        isNull(schema.leadTasks.completedAt),
        sql`${schema.leadTasks.dueAt} < ${now.toISOString()}::timestamptz`,
      ))
      .orderBy(asc(schema.leadTasks.dueAt)),
    db.select({ brokerId: schema.leads.corretorId, leadId: schema.leads.id, leadName: schema.leads.nome })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        inArray(schema.leads.corretorId, [...brokerIds]),
        inArray(schema.leads.status, [...ACTIVE_STATUSES]),
        isNull(schema.leads.deletedAt),
        isNull(schema.leads.archivedAt),
      ))
      .orderBy(asc(schema.leads.stageEnteredAt)),
  ]);

  const lastAcceptByBroker = new Map(acceptRows.map((row) => [row.brokerId, row.lastAcceptedAt ? new Date(row.lastAcceptedAt) : null]));
  const onDuty: OnDutyBroker[] = dutyRows
    .map((row) => ({ id: row.brokerId, name: row.name ?? "Corretor", dutyStartedAt: new Date(`${today}T${row.startsAt}:00-03:00`), lastAcceptedAt: lastAcceptByBroker.get(row.brokerId) ?? null }))
    .filter((duty) => duty.dutyStartedAt.getTime() <= now.getTime());

  const criticalLeads = new Map<string, CriticalLead>();
  for (const row of overdueRows) {
    if (row.brokerId && !criticalLeads.has(row.brokerId)) criticalLeads.set(row.brokerId, { leadId: row.leadId, leadName: row.leadName ?? "Lead" });
  }
  for (const row of activeRows) {
    if (row.brokerId && !criticalLeads.has(row.brokerId)) criticalLeads.set(row.brokerId, { leadId: row.leadId, leadName: row.leadName ?? "Lead" });
  }
  return { onDuty, criticalLeads };
}

import "server-only";

import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { isSupervisorObservationInScope, pageSupervisorObservationRows, readSupervisorObservation, readSupervisorObservationStage } from "./observations-core";

const PAGE_SIZE = 50;

const STAGES = ["new", "distributed", "in_contact", "contacted", "quote_sent", "negotiation", "documentation_pending", "under_analysis", "awaiting_reply", "converted", "lost"] as const;
export type SupervisorObservationStage = (typeof STAGES)[number];
const LEGACY_STAGE_LABELS: Record<SupervisorObservationStage, string> = {
  new: "Novo", distributed: "Distribuído", in_contact: "Em Atendimento", contacted: "Entrei em Contato",
  quote_sent: "Cotação Enviada", negotiation: "Negociação", documentation_pending: "Documentação Pendente",
  under_analysis: "Em Análise", awaiting_reply: "Aguardando Retorno", converted: "Convertido", lost: "Perdido",
};

export type SupervisorObservationFilter = { brokerId?: string; stage?: string; beforeAt?: string; beforeId?: string };

export async function getSupervisorObservationPage(context: TenantContext, filter: SupervisorObservationFilter = {}) {
  if (context.role !== "supervisor" || !context.supervisorTeamScope || !context.branchId || (await getLiteAudience(context)) !== "supervisor") return null;

  const db = getDatabase();
  const memberships = schema.tenantMemberships;
  const brokers = await db.select({ id: memberships.userId, name: schema.user.name })
    .from(memberships)
    .innerJoin(schema.user, eq(schema.user.id, memberships.userId))
    .where(and(
      eq(memberships.tenantId, context.tenantId),
      eq(memberships.branchId, context.branchId),
      eq(memberships.supervisorId, context.userId),
      eq(memberships.role, "broker"),
      eq(memberships.status, "active"),
      eq(schema.user.status, "active"),
      eq(schema.user.active, true),
    ))
    .orderBy(asc(schema.user.name));
  const brokerIds = brokers.map((broker) => broker.id);
  if (!brokerIds.length) return { brokers, observations: [], hasMore: false, next: null };

  const beforeAt = filter.beforeAt?.trim() ?? "";
  const validCursor = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(beforeAt)
    && Number.isFinite(Date.parse(beforeAt))
    && Boolean(filter.beforeId?.trim());
  const stage = (STAGES as readonly string[]).includes(filter.stage ?? "") ? filter.stage as SupervisorObservationStage : null;
  const observationExists = sql`(nullif(trim(${schema.leadInteractions.metadata}->>'observation'), '') is not null or ${schema.leadInteractions.conteudo} ilike '%Como foi o contato:%')`;
  const stageAtObservation = sql<string | null>`${schema.leadInteractions.metadata}->>'toStatus'`;
  const rows = await db.select({
    id: schema.leadInteractions.id,
    tenantId: schema.leads.tenantId,
    branchId: schema.leads.branchId,
    leadId: schema.leads.id,
    leadName: schema.leads.nome,
    leadOwnerId: schema.leads.corretorId,
    authorId: schema.leadInteractions.userId,
    authorName: schema.user.name,
    metadata: schema.leadInteractions.metadata,
    content: schema.leadInteractions.conteudo,
    stage: stageAtObservation,
    createdAt: schema.leadInteractions.createdAt,
    createdAtCursor: sql<string>`${schema.leadInteractions.createdAt}::text`,
  }).from(schema.leadInteractions)
    .innerJoin(schema.leads, and(eq(schema.leads.id, schema.leadInteractions.leadId), eq(schema.leads.tenantId, context.tenantId)))
    .innerJoin(schema.user, eq(schema.user.id, schema.leadInteractions.userId))
    .where(and(
      eq(schema.leads.tenantId, context.tenantId),
      eq(schema.leads.branchId, context.branchId),
      inArray(schema.leads.corretorId, brokerIds),
      inArray(schema.leadInteractions.userId, brokerIds),
      eq(schema.leadInteractions.tipo, "status_change"),
      observationExists,
      isNull(schema.leads.deletedAt),
      isNull(schema.leads.archivedAt),
      filter.brokerId ? eq(schema.leadInteractions.userId, filter.brokerId) : undefined,
      stage ? or(eq(stageAtObservation, stage), sql`${schema.leadInteractions.conteudo} ilike ${`Status alterado: % → ${LEGACY_STAGE_LABELS[stage]}.%`}`, stage === "contacted" ? sql`${schema.leadInteractions.conteudo} ilike 'Novo contato registrado.%'` : undefined) : undefined,
      validCursor ? or(lt(schema.leadInteractions.createdAt, sql`${beforeAt}::timestamptz`), and(eq(schema.leadInteractions.createdAt, sql`${beforeAt}::timestamptz`), lt(schema.leadInteractions.id, filter.beforeId!.trim()))) : undefined,
    ))
    .orderBy(desc(schema.leadInteractions.createdAt), desc(schema.leadInteractions.id))
    .limit(PAGE_SIZE + 1);

  const page = pageSupervisorObservationRows(rows, PAGE_SIZE);
  const scope = { role: context.role, tenantId: context.tenantId, branchId: context.branchId, supervisorId: context.userId, teamBrokerIds: brokerIds };
  const observations = page.pageRows.flatMap((row) => {
    if (!isSupervisorObservationInScope(scope, { tenantId: row.tenantId, branchId: row.branchId, leadOwnerId: row.leadOwnerId, authorId: row.authorId })) return [];
    const observation = readSupervisorObservation(row.metadata, row.content);
    if (!observation) return [];
    return [{ id: row.id, leadId: row.leadId, leadName: row.leadName, brokerId: row.authorId, brokerName: row.authorName, stage: readSupervisorObservationStage(row.metadata, row.content), text: observation, createdAt: row.createdAt.toISOString() }];
  });
  return {
    brokers,
    observations,
    hasMore: page.hasMore,
    next: page.next,
  };
}

export const SUPERVISOR_OBSERVATION_STAGES = STAGES;

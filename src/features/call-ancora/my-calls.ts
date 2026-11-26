import "server-only";

import { and, asc, desc, eq, gte, inArray, isNull, sql, type SQL } from "drizzle-orm";

import { getSupervisedBrokerIds } from "@/features/team/supervisor-service";
import { resolveAccessContext } from "@/shared/auth/access-context";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { CALL_ANCORA_SOURCE } from "./cold-base";
import {
  effectiveCalls,
  narrowCallerScope,
  resolveCallerScope,
  summarizeMyCalls,
  type CallerScope,
  type MyCallRow,
  type MyCallsFilters,
  type MyCallsSummary,
} from "./my-calls-rules";
import { periodStart, type CallAncoraReportOutcome } from "./report-rules";
import { maskPhone, normalizeBrPhone } from "./test-list";

const OUTCOMES = new Set<CallAncoraReportOutcome>(["interested", "not_interested", "no_answer", "voicemail", "wrong_number"]);
const MAX_ROWS = 2000;

export type MyCallsResult = {
  rows: MyCallRow[];
  summary: MyCallsSummary;
  brokers: { id: string; name: string }[];
  /** Chegou ao limite de linhas lidas: o resumo vale para as mais recentes. */
  truncated: boolean;
};

async function activeMemberIds(context: TenantContext, condition: SQL) {
  const rows = await getDatabase()
    .select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.status, "active"), condition));
  return rows.map((row) => row.userId);
}

/** Escopo de quem ligou, pela sessão: cargo personalizado primeiro, depois o papel. */
async function callerScopeFor(context: TenantContext): Promise<CallerScope> {
  const self: CallerScope = { kind: "users", userIds: [context.userId] };
  if (context.role === "broker") return self;
  if (context.customRoleId) {
    const effective = await resolveAccessContext(context);
    if (effective.scopeType === "NONE" || effective.scope.ownership === "SELF") return self;
    if (effective.scope.tenantWide) return resolveCallerScope({ role: context.role, userId: context.userId, tenantWide: true });
    if (effective.allowedUnitIds.length > 0) {
      const teamIds = await activeMemberIds(context, inArray(schema.tenantMemberships.branchId, effective.allowedUnitIds));
      return resolveCallerScope({ role: context.role, userId: context.userId, teamIds });
    }
    return self;
  }
  if (context.role === "supervisor") {
    const teamIds = await getSupervisedBrokerIds(context.tenantId, context.userId);
    return resolveCallerScope({ role: context.role, userId: context.userId, teamIds });
  }
  if (context.role === "manager") {
    const teamIds = context.branchId ? await activeMemberIds(context, eq(schema.tenantMemberships.branchId, context.branchId)) : [];
    return resolveCallerScope({ role: context.role, userId: context.userId, teamIds });
  }
  return resolveCallerScope({ role: context.role, userId: context.userId });
}

function callerCondition(scope: CallerScope) {
  return scope.kind === "tenant" ? undefined : inArray(schema.leadInteractions.userId, scope.userIds);
}

/**
 * Ligações do Call Âncora no período, no escopo de quem está vendo (somente leitura). Usa o índice parcial das
 * notas (`tipo = note`) por usuário e data. Telefone sempre mascarado.
 */
export async function getMyCalls(context: TenantContext, filters: MyCallsFilters, now: Date = new Date()): Promise<MyCallsResult> {
  const db = getDatabase();
  const baseScope = await callerScopeFor(context);
  const scope = narrowCallerScope(baseScope, filters.brokerId);
  const since = periodStart(filters.period, now);
  const sourceIsCallAncora = sql`${schema.leadInteractions.metadata}->>'source' = ${CALL_ANCORA_SOURCE}`;
  const inTenant = [eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt), eq(schema.leadInteractions.tipo, "note"), sourceIsCallAncora];

  const [rows, brokerRows] = await Promise.all([
    db.select({
      id: schema.leadInteractions.id,
      brokerId: schema.leadInteractions.userId,
      brokerName: schema.user.name,
      leadId: schema.leads.id,
      leadName: schema.leads.nome,
      phone: schema.leads.telefone,
      metadata: schema.leadInteractions.metadata,
      at: schema.leadInteractions.createdAt,
    })
      .from(schema.leadInteractions)
      .innerJoin(schema.leads, eq(schema.leads.id, schema.leadInteractions.leadId))
      .innerJoin(schema.user, eq(schema.user.id, schema.leadInteractions.userId))
      .where(and(...inTenant, callerCondition(scope), gte(schema.leadInteractions.createdAt, since)))
      .orderBy(desc(schema.leadInteractions.createdAt))
      .limit(MAX_ROWS),
    // Corretores do filtro: quem ligou nos últimos 30 dias dentro do escopo do papel (não do filtro escolhido).
    baseScope.kind === "users" && baseScope.userIds.length === 1
      ? Promise.resolve([] as { id: string; name: string | null }[])
      : db.selectDistinct({ id: schema.user.id, name: schema.user.name })
        .from(schema.leadInteractions)
        .innerJoin(schema.leads, eq(schema.leads.id, schema.leadInteractions.leadId))
        .innerJoin(schema.user, eq(schema.user.id, schema.leadInteractions.userId))
        .where(and(...inTenant, callerCondition(baseScope), gte(schema.leadInteractions.createdAt, periodStart("30d", now))))
        .orderBy(asc(schema.user.name))
        .limit(200),
  ]);

  const calls: MyCallRow[] = [];
  for (const row of rows) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const outcome = meta.outcome as CallAncoraReportOutcome;
    if (!OUTCOMES.has(outcome)) continue;
    const phone = normalizeBrPhone(row.phone);
    calls.push({
      id: row.id,
      brokerId: row.brokerId,
      brokerName: row.brokerName,
      leadId: row.leadId,
      leadName: row.leadName,
      phoneMasked: phone ? maskPhone(phone) : "••••",
      outcome,
      talkSeconds: typeof meta.talkSeconds === "number" && Number.isFinite(meta.talkSeconds) ? meta.talkSeconds : 0,
      correction: meta.correction === true,
      at: row.at.toISOString(),
    });
  }
  const effective = effectiveCalls(calls);
  return {
    rows: effective,
    summary: summarizeMyCalls(effective),
    brokers: brokerRows.map((row) => ({ id: row.id, name: row.name ?? "Sem nome" })),
    truncated: rows.length >= MAX_ROWS,
  };
}

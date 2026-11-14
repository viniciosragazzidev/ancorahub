import "server-only";
import { and, asc, countDistinct, desc, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { canAccessRoute } from "@/features/custom-roles/effective-access";
import { getRouteDefinition } from "@/features/custom-roles/routes";
import { getFeatureFlag } from "@/features/system-settings/queries";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

import { auditActor, auditErp, erpScopeSql, getErpEffectiveAccess, getErpPlatformState, requireErpAccess, type ErpDatabase } from "./access";
import { advanceAvailableSql, confirmedSettledSql, openBalanceSql } from "./balances";
import {
  amountOrNoData, BROKER_COMMISSION_STATE_LABELS, brokerCommissionState, monthSeries, periodLabel, shiftPeriod,
  type BrokerCommissionRow, type BrokerFinanceDetail, type BrokerFinanceInsights, type BrokerFinanceSummary, type BrokerPayoutRow,
} from "./broker-finance-core";
import { numericToCents } from "./commission-core";
import { ErpError } from "./contracts";
import { checkedCents } from "./ledger";
import type { ErpAccess } from "./records";
import { currentPeriod, pageSchema, periodBounds } from "./shared";

/**
 * Meu financeiro do corretor (Lite), somente leitura. Só a própria pessoa: o escopo do ERP da sessão E o beneficiário
 * igual ao usuário da sessão, sempre. Nenhuma fórmula nova: a receber é o saldo em aberto das comissões aprovadas
 * (`openBalanceSql`, como o "A pagar" do ERP), recebido no mês é a liquidação confirmada das comissões no mês
 * (pagamentos menos estornos, como `settledCents`) e adiantamento em aberto é o saldo compensável (`advanceAvailableSql`).
 */

export const BROKER_FINANCE_AUDIT_ACTION = "erp.broker_finance.viewed";
export const BROKER_FINANCE_SUMMARY_AUDIT_ACTION = "erp.broker_finance.summary_viewed";
/** O cartão do Início pode ser carregado a cada visita: o acesso ao resumo é auditado no máximo uma vez por hora. */
const SUMMARY_AUDIT_INTERVAL_MS = 60 * 60 * 1000;
export const BROKER_FINANCE_PAGE_SIZE = 20;
export const BROKER_FINANCE_PAYOUT_LIMIT = 12;

export type { BrokerCommissionRow, BrokerFinanceDetail, BrokerFinanceInsights, BrokerFinanceSummary, BrokerPayoutRow };

export async function isBrokerLiteFinanceEnabled() {
  const value = await getFeatureFlag(FEATURE_FLAGS.BROKER_LITE_FINANCE).catch(() => FEATURE_FLAGS.BROKER_LITE_FINANCE.defaultValue);
  return value === "true";
}

/**
 * Mesma verificação das telas /financeiro/* do corretor: rota de Comissões (permissão `ver_comissao_propria`, e a chave
 * da rota para quem tem cargo) e acesso ao módulo financeiro do ERP (liberado pela plataforma, ativo para a empresa e
 * para o perfil, `erp_view_finance` e escopo). Qualquer recusa vira null, sem detalhe.
 */
export async function resolveBrokerFinanceAccess(context: TenantContext): Promise<{ auth: ErpAccess; receiptLinks: boolean } | null> {
  if (!(await isBrokerLiteFinanceEnabled())) return null;
  // Antes da plataforma ligar o ERP as tabelas podem nem existir.
  const platform = await getErpPlatformState().catch(() => null);
  if (!platform?.enabled || !platform.modules.includes("finance")) return null;
  let auth: ErpAccess;
  try {
    auth = await requireErpAccess("finance", "erp_view_finance");
  } catch (error) {
    if (error instanceof ErpError) return null;
    throw error;
  }
  // A identidade é a da sessão; um contexto diferente nunca abre o financeiro de outra pessoa.
  if (auth.context.tenantId !== context.tenantId || auth.context.userId !== context.userId) return null;
  const access = await getErpEffectiveAccess(auth.context);
  if (!canAccessRoute(access, getRouteDefinition("/financeiro/comissoes"))) return null;
  return { auth, receiptLinks: canAccessRoute(access, getRouteDefinition("/financeiro/recibos")) };
}

/** Lançamentos aprovados do próprio corretor, dentro do escopo do ERP. */
export function ownApprovedEntriesWhere(auth: ErpAccess) {
  const entries = schema.erpFinancialEntries;
  return and(
    eq(entries.tenantId, auth.context.tenantId),
    erpScopeSql(auth.scope, entries.branchId, entries.ownerId),
    eq(entries.beneficiaryId, auth.context.userId),
    eq(entries.status, "approved"),
  );
}

async function computeSummary(db: ErpDatabase, auth: ErpAccess, now: Date): Promise<BrokerFinanceSummary> {
  const entries = schema.erpFinancialEntries;
  const tenantId = auth.context.tenantId;
  const period = currentPeriod(now);
  const { start, end } = periodBounds(period);
  const own = ownApprovedEntriesWhere(auth);
  const isCommission = sql`${entries.kind} = 'broker_commission'`;
  const isAdvance = sql`${entries.kind} = 'advance'`;
  const [[totals], [received]] = await Promise.all([
    // O join faz o Drizzle qualificar as colunas de fora, como em getFinancialEntries.
    db.select({
      commissions: sql<number>`count(*) FILTER (WHERE ${isCommission})::int`.mapWith(Number),
      receivable: sql<number>`coalesce(sum(CASE WHEN ${isCommission} THEN greatest(${openBalanceSql(tenantId)}, 0) ELSE 0 END), 0)::bigint`.mapWith(Number),
      advances: sql<number>`count(*) FILTER (WHERE ${isAdvance})::int`.mapWith(Number),
      openAdvances: sql<number>`coalesce(sum(CASE WHEN ${isAdvance} THEN greatest(${advanceAvailableSql(tenantId)}, 0) ELSE 0 END), 0)::bigint`.mapWith(Number),
    }).from(entries).leftJoin(schema.user, eq(schema.user.id, entries.beneficiaryId))
      .where(and(own, inArray(entries.kind, ["broker_commission", "advance"]))),
    db.select({
      value: sql<number>`coalesce(sum(CASE WHEN ${schema.erpSettlements.kind} = 'reversal' THEN -${schema.erpSettlements.amountCents} ELSE ${schema.erpSettlements.amountCents} END), 0)::bigint`.mapWith(Number),
    }).from(schema.erpSettlements)
      .innerJoin(entries, and(eq(entries.tenantId, tenantId), eq(entries.id, schema.erpSettlements.entryId)))
      .where(and(eq(schema.erpSettlements.tenantId, tenantId), eq(schema.erpSettlements.status, "confirmed"),
        gte(schema.erpSettlements.occurredOn, start), lt(schema.erpSettlements.occurredOn, end), own, isCommission)),
  ]);
  const commissions = totals?.commissions ?? 0;
  return {
    period, periodLabel: periodLabel(period),
    receivableCents: amountOrNoData(commissions, checkedCents(totals?.receivable ?? 0)),
    receivedThisMonthCents: amountOrNoData(commissions, checkedCents(received?.value ?? 0)),
    openAdvancesCents: amountOrNoData(totals?.advances ?? 0, checkedCents(totals?.openAdvances ?? 0)),
  };
}

async function auditSummaryView(db: ErpDatabase, auth: ErpAccess) {
  const events = schema.erpEvents;
  const actorId = auditActor(auth.context);
  const [recent] = await db.select({ id: events.id }).from(events).where(and(
    eq(events.tenantId, auth.context.tenantId), eq(events.entityType, "erp_access"), eq(events.entityId, "broker_finance"),
    eq(events.actorId, actorId), eq(events.action, BROKER_FINANCE_SUMMARY_AUDIT_ACTION), gte(events.createdAt, new Date(Date.now() - SUMMARY_AUDIT_INTERVAL_MS)),
  )).limit(1);
  if (recent) return;
  await auditErp(db, { tenantId: auth.context.tenantId, actorId, action: BROKER_FINANCE_SUMMARY_AUDIT_ACTION, entityType: "erp_access", entityId: "broker_finance" });
}

/** Resumo "Meu mês" do próprio corretor; null sem a chave, sem o módulo financeiro ou sem permissão. */
export async function getBrokerFinanceSummary(context: TenantContext, now: Date = new Date()): Promise<BrokerFinanceSummary | null> {
  const resolved = await resolveBrokerFinanceAccess(context);
  if (!resolved) return null;
  const db = getDatabase();
  const summary = await computeSummary(db, resolved.auth, now);
  await auditSummaryView(db, resolved.auth);
  return summary;
}

async function ownCommissionRows(db: ErpDatabase, auth: ErpAccess, page: number) {
  const tenantId = auth.context.tenantId;
  const schedule = schema.commissionSchedule;
  const fetched = await db.select({
    id: schedule.id, monthNumber: schedule.monthNumber, referenceMonth: schedule.referenceMonth, amount: schedule.amount, scheduleStatus: schedule.status,
    clientName: schema.leads.nome, planName: schema.carrierPlans.name, carrierName: schema.carriers.name,
  }).from(schedule)
    .innerJoin(schema.sales, and(eq(schema.sales.id, schedule.saleId), eq(schema.sales.tenantId, tenantId)))
    .innerJoin(schema.leads, and(eq(schema.leads.id, schema.sales.leadId), eq(schema.leads.tenantId, tenantId), isNull(schema.leads.deletedAt)))
    .leftJoin(schema.carrierPlans, eq(schema.carrierPlans.id, schema.sales.carrierPlanId))
    .leftJoin(schema.carriers, eq(schema.carriers.id, schema.carrierPlans.carrierId))
    .where(and(eq(schedule.tenantId, tenantId), eq(schema.sales.brokerId, auth.context.userId), erpScopeSql(auth.scope, schema.leads.branchId, schema.sales.brokerId)))
    .orderBy(desc(schedule.referenceMonth), asc(schema.leads.nome), asc(schedule.monthNumber), asc(schedule.id))
    .limit(BROKER_FINANCE_PAGE_SIZE + 1).offset((page - 1) * BROKER_FINANCE_PAGE_SIZE);
  const rows = fetched.slice(0, BROKER_FINANCE_PAGE_SIZE);
  const ids = rows.map((row) => row.id);
  const entries = schema.erpFinancialEntries;
  const linked = ids.length ? await db.select({ originCommissionId: entries.originCommissionId, status: entries.status, amountCents: entries.amountCents, settledCents: confirmedSettledSql(tenantId) })
    .from(entries).leftJoin(schema.user, eq(schema.user.id, entries.beneficiaryId))
    .where(and(eq(entries.tenantId, tenantId), erpScopeSql(auth.scope, entries.branchId, entries.ownerId), eq(entries.beneficiaryId, auth.context.userId),
      eq(entries.kind, "broker_commission"), inArray(entries.originCommissionId, ids))) : [];
  // Uma parcela pode ter um lançamento rejeitado e outro aprovado: o aprovado manda.
  const byCommission = new Map<string, (typeof linked)[number]>();
  for (const entry of linked) {
    if (!entry.originCommissionId) continue;
    const current = byCommission.get(entry.originCommissionId);
    if (!current || (current.status !== "approved" && entry.status === "approved")) byCommission.set(entry.originCommissionId, entry);
  }
  return {
    hasNext: fetched.length > BROKER_FINANCE_PAGE_SIZE,
    rows: rows.map((row): BrokerCommissionRow => {
      const entry = byCommission.get(row.id) ?? null;
      const { state, source } = brokerCommissionState({ scheduleStatus: row.scheduleStatus, entry: entry ? { status: entry.status, amountCents: entry.amountCents, settledCents: checkedCents(entry.settledCents) } : null });
      const product = [row.carrierName, row.planName].filter(Boolean).join(" · ") || null;
      return {
        id: row.id, clientName: row.clientName, product, installment: row.monthNumber, referenceMonth: row.referenceMonth,
        amountCents: source === "erp" && entry ? entry.amountCents : numericToCents(row.amount), state, stateLabel: BROKER_COMMISSION_STATE_LABELS[state], source,
      };
    }),
  };
}

/** Repasses conferidos (com recibo) do próprio corretor: o ERP só mostra ao corretor o repasse liquidado. */
async function ownSettledPayouts(db: ErpDatabase, auth: ErpAccess, receiptLinks: boolean): Promise<BrokerPayoutRow[]> {
  const payouts = schema.erpPayouts;
  const rows = await db.select({ id: payouts.id, competence: payouts.competence, occurredOn: payouts.occurredOn, netCents: payouts.netCents, receiptNumber: payouts.receiptNumber })
    .from(payouts)
    .where(and(eq(payouts.tenantId, auth.context.tenantId), erpScopeSql(auth.scope, payouts.branchId, payouts.beneficiaryId),
      eq(payouts.beneficiaryId, auth.context.userId), eq(payouts.status, "settled")))
    .orderBy(desc(payouts.occurredOn), desc(payouts.createdAt), desc(payouts.id)).limit(BROKER_FINANCE_PAYOUT_LIMIT);
  return rows.map((row) => ({ ...row, netCents: checkedCents(row.netCents), receiptHref: receiptLinks && row.receiptNumber ? `/financeiro/recibos/${row.id}` : null }));
}

const INSIGHT_MONTHS = 6;

/**
 * Gráficos do Meu financeiro, sem fórmula nova: recebido por mês é a mesma liquidação confirmada do "Recebido no mês"
 * (pagamentos menos estornos) agrupada por mês; o previsto é a soma das parcelas pendentes do cronograma das próprias
 * vendas, como a lista de comissões já mostra uma a uma.
 */
async function computeInsights(db: ErpDatabase, auth: ErpAccess, now: Date): Promise<BrokerFinanceInsights> {
  const tenantId = auth.context.tenantId;
  const entries = schema.erpFinancialEntries;
  const settlements = schema.erpSettlements;
  const schedule = schema.commissionSchedule;
  const current = currentPeriod(now);
  const firstReceived = shiftPeriod(current, -(INSIGHT_MONTHS - 1));
  const lastForecast = shiftPeriod(current, INSIGHT_MONTHS - 1);
  const month = sql<string>`to_char(${settlements.occurredOn}, 'YYYY-MM')`;
  const ownSchedule = and(
    eq(schedule.tenantId, tenantId),
    eq(schema.sales.brokerId, auth.context.userId),
    erpScopeSql(auth.scope, schema.leads.branchId, schema.sales.brokerId),
  );
  const salesJoin = and(eq(schema.sales.id, schedule.saleId), eq(schema.sales.tenantId, tenantId));
  const leadsJoin = and(eq(schema.leads.id, schema.sales.leadId), eq(schema.leads.tenantId, tenantId), isNull(schema.leads.deletedAt));
  const [receivedRows, forecastRows, [sales], [next]] = await Promise.all([
    db.select({
      period: month,
      value: sql<number>`coalesce(sum(CASE WHEN ${settlements.kind} = 'reversal' THEN -${settlements.amountCents} ELSE ${settlements.amountCents} END), 0)::bigint`.mapWith(Number),
    }).from(settlements)
      .innerJoin(entries, and(eq(entries.tenantId, tenantId), eq(entries.id, settlements.entryId)))
      .where(and(eq(settlements.tenantId, tenantId), eq(settlements.status, "confirmed"),
        gte(settlements.occurredOn, periodBounds(firstReceived).start), lt(settlements.occurredOn, periodBounds(current).end),
        ownApprovedEntriesWhere(auth), sql`${entries.kind} = 'broker_commission'`))
      .groupBy(month),
    db.select({ period: schedule.referenceMonth, value: sql<string>`coalesce(sum(${schedule.amount}), 0)::numeric(14,2)::text` })
      .from(schedule).innerJoin(schema.sales, salesJoin).innerJoin(schema.leads, leadsJoin)
      .where(and(ownSchedule, eq(schedule.status, "pending"), gte(schedule.referenceMonth, current), lte(schedule.referenceMonth, lastForecast)))
      .groupBy(schedule.referenceMonth),
    db.select({ count: countDistinct(schedule.saleId) })
      .from(schedule).innerJoin(schema.sales, salesJoin).innerJoin(schema.leads, leadsJoin)
      .where(ownSchedule),
    db.select({ referenceMonth: schedule.referenceMonth, amount: schedule.amount, clientName: schema.leads.nome })
      .from(schedule).innerJoin(schema.sales, salesJoin).innerJoin(schema.leads, leadsJoin)
      .where(and(ownSchedule, eq(schedule.status, "pending"), gte(schedule.referenceMonth, current)))
      .orderBy(asc(schedule.referenceMonth), asc(schedule.dueDate), asc(schedule.id))
      .limit(1),
  ]);
  const received = monthSeries(firstReceived, INSIGHT_MONTHS, new Map(receivedRows.map((row) => [row.period, checkedCents(row.value)])));
  const forecast = monthSeries(current, INSIGHT_MONTHS, new Map(forecastRows.map((row) => [row.period, numericToCents(row.value)])));
  return {
    received,
    forecast,
    receivedTotalCents: checkedCents(received.reduce((total, point) => total + point.cents, 0)),
    forecastTotalCents: checkedCents(forecast.reduce((total, point) => total + point.cents, 0)),
    salesWithCommission: sales?.count ?? 0,
    nextInstallment: next ? { referenceMonth: next.referenceMonth, amountCents: numericToCents(next.amount), clientName: next.clientName } : null,
  };
}

const detailInput = z.object({ page: pageSchema });

/** Tela /meu-financeiro: resumo, comissões por venda (paginadas) e repasses com recibo. Auditada a cada leitura, como /financeiro. */
export async function getBrokerFinanceDetail(context: TenantContext, raw: unknown = {}, now: Date = new Date()): Promise<BrokerFinanceDetail | null> {
  const { page } = detailInput.parse(raw);
  const resolved = await resolveBrokerFinanceAccess(context);
  if (!resolved) return null;
  const { auth, receiptLinks } = resolved;
  const db = getDatabase();
  const [summary, commissions, payouts, insights] = await Promise.all([
    computeSummary(db, auth, now), ownCommissionRows(db, auth, page), ownSettledPayouts(db, auth, receiptLinks),
    // Os gráficos não derrubam a tela: sem eles, os números e as listas continuam.
    computeInsights(db, auth, now).catch((error: unknown) => {
      console.error("[meu-financeiro] gráficos indisponíveis", error instanceof Error ? error.message : "erro desconhecido");
      return null;
    }),
  ]);
  await auditErp(db, { tenantId: auth.context.tenantId, actorId: auditActor(auth.context), action: BROKER_FINANCE_AUDIT_ACTION, entityType: "erp_access", entityId: "broker_finance",
    metadata: { page, commissions: commissions.rows.length, payouts: payouts.length } });
  return {
    summary,
    insights,
    commissions: { rows: commissions.rows, page, pageSize: BROKER_FINANCE_PAGE_SIZE, hasNext: commissions.hasNext },
    payouts,
    receiptsHref: receiptLinks ? "/financeiro/recibos" : null,
  };
}

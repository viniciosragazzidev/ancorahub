import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { auditErp, erpScopeSql, requireErpAccess } from "./access";
import { ANALYTICS_TIME_ZONE, monthKey, shiftMonth, sumCents } from "./analytics-core";
import { analyticsVisibility } from "./analytics";

export type TvTile =
  | { id: string; kind: "number"; label: string; value: string; hint: string }
  | { id: string; kind: "ranking"; label: string; hint: string; items: { label: string; value: string }[] };

const TZ = sql.raw(`'${ANALYTICS_TIME_ZONE}'`);
const monthStart = (month: string) => sql`((${`${month}-01`})::date::timestamp AT TIME ZONE ${TZ})`;
const count = (value: number) => value.toLocaleString("pt-BR");
const currency = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Approved aggregated tiles only: no remuneration, contacts or documents. Names only with an explicit tenant policy. */
export async function getTvBoard() {
  const db = getDatabase();
  const auth = await requireErpAccess("tv", "erp_view_analytics", db);
  const params = auth.setting?.params ?? {};
  const showNames = params.showNames === true;
  const rawInterval = typeof params.intervalSeconds === "number" ? params.intervalSeconds : 20;
  const intervalSeconds = Number.isInteger(rawInterval) && rawInterval >= 5 && rawInterval <= 300 ? rawInterval : 20;
  const visibility = analyticsVisibility(auth);
  const month = monthKey();
  const tenant = auth.context.tenantId;
  const salesWhere = and(eq(schema.sales.tenantId, tenant), eq(schema.sales.status, "active"), erpScopeSql(auth.scope, schema.leads.branchId, schema.sales.brokerId),
    sql`${schema.sales.saleDate} >= ${monthStart(month)}`, sql`${schema.sales.saleDate} < ${monthStart(shiftMonth(month, 1))}`);
  const salesJoin = and(eq(schema.leads.id, schema.sales.leadId), eq(schema.leads.tenantId, schema.sales.tenantId));
  const implantedMonth = sql`to_char(coalesce(${schema.erpImplantations.coverageStartsOn}, (${schema.erpImplantations.updatedAt} AT TIME ZONE ${TZ})::date), 'YYYY-MM')`;
  const [[production], [implanted], units, brokers] = await Promise.all([
    db.select({ count: sql<number>`count(distinct ${schema.sales.id})::int`, cents: sql<string>`coalesce(sum(${schema.sales.saleValue} * 100), 0)::numeric(30,0)::text` })
      .from(schema.sales).innerJoin(schema.leads, salesJoin).where(salesWhere),
    db.select({ count: sql<number>`count(distinct ${schema.erpImplantations.id})::int` }).from(schema.erpImplantations)
      .where(and(eq(schema.erpImplantations.tenantId, tenant), eq(schema.erpImplantations.status, "implanted"), erpScopeSql(auth.scope, schema.erpImplantations.branchId, schema.erpImplantations.brokerId), sql`${implantedMonth} = ${month}`)),
    db.select({ name: schema.branches.name, count: sql<number>`count(distinct ${schema.sales.id})::int` }).from(schema.sales).innerJoin(schema.leads, salesJoin)
      .innerJoin(schema.branches, and(eq(schema.branches.id, schema.leads.branchId), eq(schema.branches.tenantId, tenant)))
      .where(salesWhere).groupBy(schema.branches.id, schema.branches.name).orderBy(sql`count(distinct ${schema.sales.id}) desc`, schema.branches.name).limit(5),
    showNames ? db.select({ name: schema.user.name, count: sql<number>`count(distinct ${schema.sales.id})::int` }).from(schema.sales).innerJoin(schema.leads, salesJoin)
      .innerJoin(schema.user, eq(schema.user.id, schema.sales.brokerId))
      .where(salesWhere).groupBy(schema.user.id, schema.user.name).orderBy(sql`count(distinct ${schema.sales.id}) desc`, schema.user.name).limit(5) : Promise.resolve([]),
  ]);
  const tiles: TvTile[] = [
    { id: "production-count", kind: "number", label: "Vendas no mês", value: count(Number(production?.count ?? 0)), hint: "Vendas ativas pela data da venda" },
  ];
  if (visibility.values) tiles.push({ id: "production-value", kind: "number", label: "Valor vendido no mês", value: currency(sumCents([production?.cents ?? "0"])), hint: "Valor comercial informado nas vendas ativas" });
  tiles.push({ id: "implanted", kind: "number", label: "Implantações no mês", value: count(Number(implanted?.count ?? 0)), hint: "Implantações concluídas pelo início de cobertura" });
  if (units.length) tiles.push({ id: "units", kind: "ranking", label: "Unidades com mais vendas", hint: "Vendas ativas no mês", items: units.map((row) => ({ label: row.name, value: count(Number(row.count)) })) });
  if (showNames && brokers.length) tiles.push({ id: "brokers", kind: "ranking", label: "Destaques do mês", hint: "Vendas ativas no mês", items: brokers.map((row) => ({ label: row.name, value: count(Number(row.count)) })) });
  await auditErp(db, { tenantId: tenant, actorId: auth.context.viewAs?.adminUserId ?? auth.context.userId, action: "erp.analytics.viewed", entityType: "erp_access", entityId: "tv", metadata: { page: "tv", month, tiles: tiles.map((tile) => tile.id) } });
  return { month, tiles, intervalSeconds, showNames, generatedAt: new Date().toISOString() };
}

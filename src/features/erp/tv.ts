import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { auditActor, auditErp, erpScopeSql, requireErpAccess, type ErpDatabase } from "./access";
import { monthKey, sumCents } from "./analytics-core";
import { analyticsVisibility, implantedInMonths, instantInMonths } from "./analytics";

export type TvTile =
  | { id: string; kind: "number"; label: string; value: string; hint: string }
  | { id: string; kind: "ranking"; label: string; hint: string; items: { label: string; value: string; amount: number }[] };

/** The board refreshes every few minutes; the access is audited at most once per person per hour. */
export const TV_AUDIT_ACTION = "erp.tv.viewed";
const TV_AUDIT_INTERVAL_MS = 60 * 60 * 1000;

const count = (value: number) => value.toLocaleString("pt-BR");
const currency = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const salesCount = sql<number>`count(*)::int`;

type Auth = Awaited<ReturnType<typeof requireErpAccess>>;

async function auditTvView(db: ErpDatabase, auth: Auth, metadata: Record<string, unknown>) {
  const events = schema.erpEvents;
  const actorId = auditActor(auth.context);
  const since = new Date(Date.now() - TV_AUDIT_INTERVAL_MS);
  const [recent] = await db.select({ id: events.id }).from(events)
    .where(and(
      eq(events.tenantId, auth.context.tenantId), eq(events.entityType, "erp_access"), eq(events.entityId, "tv"),
      gte(events.createdAt, since), eq(events.actorId, actorId), eq(events.action, TV_AUDIT_ACTION),
    ))
    .limit(1);
  if (recent) return;
  await auditErp(db, { tenantId: auth.context.tenantId, actorId, action: TV_AUDIT_ACTION, entityType: "erp_access", entityId: "tv", metadata });
}

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
  const window = { from: month, to: month };
  const tenant = auth.context.tenantId;
  const salesWhere = and(
    eq(schema.sales.tenantId, tenant), instantInMonths(schema.sales.saleDate, window), eq(schema.sales.status, "active"),
    erpScopeSql(auth.scope, schema.leads.branchId, schema.sales.brokerId),
  );
  // Each sale joins only its own lead, unit and broker (N:1), so count(*) counts every sale once.
  const salesJoin = and(eq(schema.leads.id, schema.sales.leadId), eq(schema.leads.tenantId, schema.sales.tenantId));
  const implantations = schema.erpImplantations;
  const [[production], [implanted], units, brokers] = await Promise.all([
    db.select({ count: salesCount, cents: sql<string>`coalesce(sum(${schema.sales.saleValue} * 100), 0)::numeric(30,0)::text` })
      .from(schema.sales).innerJoin(schema.leads, salesJoin).where(salesWhere),
    db.select({ count: sql<number>`count(*)::int` }).from(implantations)
      .where(and(
        eq(implantations.tenantId, tenant), eq(implantations.status, "implanted"), implantedInMonths(window),
        erpScopeSql(auth.scope, implantations.branchId, implantations.brokerId),
      )),
    db.select({ name: schema.branches.name, count: salesCount }).from(schema.sales).innerJoin(schema.leads, salesJoin)
      .innerJoin(schema.branches, and(eq(schema.branches.id, schema.leads.branchId), eq(schema.branches.tenantId, tenant)))
      .where(salesWhere).groupBy(schema.branches.id, schema.branches.name).orderBy(desc(salesCount), schema.branches.name).limit(5),
    showNames
      ? db.select({ name: schema.user.name, count: salesCount }).from(schema.sales).innerJoin(schema.leads, salesJoin)
        .innerJoin(schema.user, eq(schema.user.id, schema.sales.brokerId))
        .where(salesWhere).groupBy(schema.user.id, schema.user.name).orderBy(desc(salesCount), schema.user.name).limit(5)
      : Promise.resolve([]),
  ]);
  const tiles: TvTile[] = [{
    id: "production-count", kind: "number", label: "Vendas no mês", value: count(Number(production?.count ?? 0)),
    hint: "Vendas ativas pela data da venda",
  }];
  if (visibility.values) {
    const value = currency(sumCents([production?.cents ?? "0"]));
    tiles.push({ id: "production-value", kind: "number", label: "Valor vendido no mês", value, hint: "Valor comercial informado nas vendas ativas" });
  }
  tiles.push({
    id: "implanted", kind: "number", label: "Implantações no mês", value: count(Number(implanted?.count ?? 0)),
    hint: "Implantações concluídas pelo início de cobertura",
  });
  if (units.length) {
    const items = units.map((row) => ({ label: row.name, value: count(Number(row.count)), amount: Number(row.count) }));
    tiles.push({ id: "units", kind: "ranking", label: "Unidades com mais vendas", hint: "Vendas ativas no mês", items });
  }
  if (showNames && brokers.length) {
    const items = brokers.map((row) => ({ label: row.name, value: count(Number(row.count)), amount: Number(row.count) }));
    tiles.push({ id: "brokers", kind: "ranking", label: "Destaques do mês", hint: "Vendas ativas no mês", items });
  }
  await auditTvView(db, auth, { page: "tv", month, tiles: tiles.map((tile) => tile.id) });
  return { month, tiles, intervalSeconds, showNames, generatedAt: new Date().toISOString() };
}

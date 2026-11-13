import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase, schema } from "@/shared/db";
import { auditActor, auditErp, canSeeAgencyBooks, erpScopeSql, getErpEffectiveAccess, hasAgencyScope, requireErpAccess, type ErpDatabase } from "./access";
import { assertIndependentReview, ErpError, financialDirection, FINANCIAL_KINDS } from "./contracts";
import { financialTransaction } from "./finance";
import { checkedCents } from "./ledger";
import { periodBounds, periodSchema } from "./shared";

const period = periodSchema;
const inputSchema = z.object({ competence: period, expectedVersion: z.number().int().nonnegative(), reason: z.string().trim().min(5).max(300) }).strict();
const snapshotSchema = z.object({ version: z.literal(1), competence: period, digest: z.string(), entryCount: z.number().int(), movementCount: z.number().int(), offsetCount: z.number().int(), cashInCents: z.number().int(), cashOutCents: z.number().int(), externalCents: z.number().int(), calculatedAt: z.string() });

async function closingSnapshot(db: ErpDatabase, tenantId: string, competence: string) {
  const bounds = periodBounds(competence);
  const entries = await db.select().from(schema.erpFinancialEntries).where(and(eq(schema.erpFinancialEntries.tenantId, tenantId), eq(schema.erpFinancialEntries.competence, competence))).orderBy(schema.erpFinancialEntries.id).limit(10001);
  const movements = await db.select({ movement: schema.erpSettlements, entry: { kind: schema.erpFinancialEntries.kind, competence: schema.erpFinancialEntries.competence } }).from(schema.erpSettlements)
    .innerJoin(schema.erpFinancialEntries, and(eq(schema.erpFinancialEntries.tenantId, tenantId), eq(schema.erpFinancialEntries.id, schema.erpSettlements.entryId)))
    .where(and(eq(schema.erpSettlements.tenantId, tenantId), or(and(gte(schema.erpSettlements.occurredOn, bounds.start), lt(schema.erpSettlements.occurredOn, bounds.end)), eq(schema.erpFinancialEntries.competence, competence)))).orderBy(schema.erpSettlements.id).limit(10001);
  const offsets = await db.select().from(schema.erpOffsets).where(and(eq(schema.erpOffsets.tenantId, tenantId), or(and(gte(schema.erpOffsets.occurredOn, bounds.start), lt(schema.erpOffsets.occurredOn, bounds.end)), sql`${schema.erpOffsets.advanceEntryId} IN (SELECT id FROM erp_financial_entries WHERE tenant_id = ${tenantId} AND competence = ${competence})`, sql`${schema.erpOffsets.commissionEntryId} IN (SELECT id FROM erp_financial_entries WHERE tenant_id = ${tenantId} AND competence = ${competence})`))).orderBy(schema.erpOffsets.id).limit(10001);
  if ([entries, movements, offsets].some((rows) => rows.length > 10000)) throw new ErpError("O fechamento excede o volume desta operação. Solicite processamento em lote ao administrador.");
  if (entries.some((row) => row.status === "submitted") || movements.some(({ movement }) => movement.status === "pending") || offsets.some((row) => row.status === "pending")) throw new ErpError("Resolva os lançamentos, liquidações e compensações aguardando revisão neste período.");
  let cashIn = BigInt(0); let cashOut = BigInt(0); let external = BigInt(0);
  for (const { movement, entry } of movements) {
    if (movement.status !== "confirmed" || movement.occurredOn.slice(0, 7) !== competence) continue;
    const amount = BigInt(movement.amountCents) * BigInt(movement.kind === "reversal" ? -1 : 1);
    const direction = financialDirection(z.enum(FINANCIAL_KINDS).parse(entry.kind));
    if (direction === "in") cashIn += amount; else if (direction === "out") cashOut += amount; else external += amount;
  }
  const digest = createHash("sha256").update(JSON.stringify({ entries, movements, offsets })).digest("hex");
  return { version: 1 as const, competence, digest, entryCount: entries.length, movementCount: movements.length, offsetCount: offsets.length, cashInCents: checkedCents(cashIn), cashOutCents: checkedCents(cashOut), externalCents: checkedCents(external), calculatedAt: new Date().toISOString() };
}
export async function prepareClosing(raw: unknown) {
  const input = inputSchema.parse(raw);
  return financialTransaction("erp_prepare_finance", async (tx, auth) => {
    if (auth.scope.mode !== "tenant") throw new ErpError("O fechamento exige delegação para a empresa inteira.");
    const [current] = await tx.select().from(schema.erpClosings).where(and(eq(schema.erpClosings.tenantId, auth.context.tenantId), eq(schema.erpClosings.competence, input.competence))).limit(1).for("update");
    if ((current?.version ?? 0) !== input.expectedVersion) throw new ErpError("O fechamento mudou. Atualize a página.");
    if (current?.status === "closed") throw new ErpError("Solicite uma reabertura antes de preparar novamente.");
    const snapshot = await closingSnapshot(tx, auth.context.tenantId, input.competence); const id = current?.id ?? crypto.randomUUID();
    const values = { status: "pending", snapshot, reason: input.reason, preparedBy: auth.context.userId, closedBy: null, version: (current?.version ?? 0) + 1, closedAt: new Date() };
    await tx.insert(schema.erpClosings).values({ id, tenantId: auth.context.tenantId, competence: input.competence, ...values }).onConflictDoUpdate({ target: [schema.erpClosings.tenantId, schema.erpClosings.competence], set: values });
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.closing.prepared", entityType: "erp_closing", entityId: id, metadata: { competence: input.competence, version: values.version, snapshot } });
    return id;
  });
}
export async function reviewClosing(raw: unknown) {
  const input = inputSchema.extend({ decision: z.enum(["close", "reopen"]) }).parse(raw);
  return financialTransaction("erp_approve_finance", async (tx, auth) => {
    if (auth.scope.mode !== "tenant") throw new ErpError("O fechamento exige delegação para a empresa inteira.");
    const [current] = await tx.select().from(schema.erpClosings).where(and(eq(schema.erpClosings.tenantId, auth.context.tenantId), eq(schema.erpClosings.competence, input.competence))).limit(1).for("update");
    if (!current || current.version !== input.expectedVersion) throw new ErpError("O fechamento mudou. Atualize e confira novamente.");
    if (input.decision === "close") {
      if (current.status !== "pending") throw new ErpError("Prepare a conferência deste período antes de fechar.");
      assertIndependentReview(auth.context.userId, current.preparedBy);
      const previous = snapshotSchema.parse(current.snapshot); const fresh = await closingSnapshot(tx, auth.context.tenantId, input.competence);
      if (fresh.digest !== previous.digest) throw new ErpError("Os fatos mudaram depois da prévia. Prepare uma nova conferência do período.");
    } else if (current.status !== "closed") throw new ErpError("Este período não está fechado.");
    await tx.update(schema.erpClosings).set({ status: input.decision === "close" ? "closed" : "reopened", reason: input.reason, closedBy: auth.context.userId, closedAt: new Date(), version: current.version + 1 }).where(and(eq(schema.erpClosings.tenantId, auth.context.tenantId), eq(schema.erpClosings.id, current.id)));
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: `erp.closing.${input.decision}`, entityType: "erp_closing", entityId: current.id, metadata: { competence: input.competence, reason: input.reason, priorSnapshot: current.snapshot, version: current.version + 1 } });
    return current.id;
  });
}
export async function getClosings() {
  const auth = await requireErpAccess("finance", "erp_view_finance");
  if (!canSeeAgencyBooks(auth.context) || auth.scope.mode !== "tenant") throw new ErpError("Fechamentos exigem delegação para a empresa inteira.");
  const db = getDatabase(); const access = await getErpEffectiveAccess(auth.context);
  const rows = await db.select().from(schema.erpClosings).where(eq(schema.erpClosings.tenantId, auth.context.tenantId)).orderBy(desc(schema.erpClosings.competence)).limit(36);
  await auditErp(db, { tenantId: auth.context.tenantId, actorId: auditActor(auth.context), action: "erp.closing.viewed", entityType: "erp_access", entityId: "closings", metadata: { count: rows.length } });
  return { canPrepare: !auth.context.viewAs && access.capabilities.has("erp_prepare_finance"), rows: rows.map((row) => ({ id: row.id, competence: row.competence, status: row.status, reason: row.reason, version: row.version, snapshot: snapshotSchema.parse(row.snapshot), canReview: !auth.context.viewAs && access.capabilities.has("erp_approve_finance") && row.preparedBy !== auth.context.userId, canReopen: !auth.context.viewAs && access.capabilities.has("erp_approve_finance") })) };
}
export async function getCashMovements(competence: string) {
  const bounds = periodBounds(competence);
  const auth = await requireErpAccess("finance", "erp_view_finance");
  if (!hasAgencyScope(auth)) throw new ErpError("O caixa exige delegação financeira para a unidade ou empresa.");
  const rows = await getDatabase().select({ kind: schema.erpFinancialEntries.kind, cents: sql<string>`coalesce(sum(CASE WHEN ${schema.erpSettlements.kind} = 'reversal' THEN -${schema.erpSettlements.amountCents} ELSE ${schema.erpSettlements.amountCents} END),0)::text`, count: sql<number>`count(*)::int` }).from(schema.erpSettlements)
    .innerJoin(schema.erpFinancialEntries, and(eq(schema.erpFinancialEntries.tenantId, auth.context.tenantId), eq(schema.erpFinancialEntries.id, schema.erpSettlements.entryId)))
    .where(and(eq(schema.erpSettlements.tenantId, auth.context.tenantId), eq(schema.erpSettlements.status, "confirmed"), gte(schema.erpSettlements.occurredOn, bounds.start), lt(schema.erpSettlements.occurredOn, bounds.end), inArray(schema.erpFinancialEntries.kind, ["agency_receivable", "broker_commission", "expense", "advance"]), erpScopeSql(auth.scope, schema.erpFinancialEntries.branchId, schema.erpFinancialEntries.ownerId))).groupBy(schema.erpFinancialEntries.kind);
  const incoming = checkedCents(rows.filter((row) => row.kind === "agency_receivable").reduce((total, row) => total + BigInt(row.cents), BigInt(0)));
  const outgoing = checkedCents(rows.filter((row) => row.kind !== "agency_receivable").reduce((total, row) => total + BigInt(row.cents), BigInt(0)));
  await auditErp(getDatabase(), { tenantId: auth.context.tenantId, actorId: auditActor(auth.context), action: "erp.cash.viewed", entityType: "erp_access", entityId: competence });
  return { competence, incoming, outgoing, net: checkedCents(BigInt(incoming) - BigInt(outgoing)), movementCount: rows.reduce((total, row) => total + row.count, 0), openingBalanceKnown: false as const };
}

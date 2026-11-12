import "server-only";
import { and, desc, eq, ne, or } from "drizzle-orm";
import { z } from "zod";
import { getDatabase, schema } from "@/shared/db";
import { auditErp, canSeeAgencyBooks, erpScopeSql, getErpEffectiveAccess, requireErpAccess, type ErpDatabase } from "./access";
import { assertIndependentReview, ErpError, moneyCentsSchema } from "./contracts";
import { assertOpenPeriods, entryMovements, financialTransaction } from "./finance";
import { assertOccurredByToday, assertPaymentCapacity, checkedCents, requireSameRequest, settledCents } from "./ledger";
import { getEntryOffsets } from "./offset-balances";
import { scopedFinancialEntry, type ErpAccess } from "./records";

const offsetInput = z.object({ requestId: z.string().uuid(), advanceEntryId: z.string().uuid(), commissionEntryId: z.string().uuid(), amountCents: moneyCentsSchema, occurredOn: z.iso.date(), reason: z.string().trim().min(5).max(300) }).strict();

async function sources(db: ErpDatabase, auth: ErpAccess, advanceId: string, commissionId: string) {
  const advance = await scopedFinancialEntry(db, auth, advanceId, true);
  const commission = await scopedFinancialEntry(db, auth, commissionId, true);
  if (advance.kind !== "advance" || commission.kind !== "broker_commission" || advance.status !== "approved" || commission.status !== "approved" || !advance.beneficiaryId || advance.beneficiaryId !== commission.beneficiaryId) throw new ErpError("A compensação exige adiantamento e comissão aprovados do mesmo beneficiário.");
  return { advance, commission };
}
export async function assertOffsetCapacity(db: ErpDatabase, auth: ErpAccess, input: z.infer<typeof offsetInput>) {
  const { advance, commission } = await sources(db, auth, input.advanceEntryId, input.commissionEntryId);
  await assertOpenPeriods(db, auth.context.tenantId, [advance.competence, commission.competence, input.occurredOn]);
  const [advanceCash, commissionCash, advanceOffsets, commissionOffsets] = await Promise.all([entryMovements(db, auth.context.tenantId, advance.id), entryMovements(db, auth.context.tenantId, commission.id), getEntryOffsets(db, auth.context.tenantId, advance.id), getEntryOffsets(db, auth.context.tenantId, commission.id)]);
  const funded = settledCents(advanceCash);
  const reversing = checkedCents(advanceCash.filter((row) => row.status === "pending" && row.kind === "reversal").reduce((sum, row) => sum + BigInt(row.amountCents), BigInt(0)));
  assertPaymentCapacity(funded - reversing, advanceOffsets.confirmed, advanceOffsets.reserved, input.amountCents);
  const pendingCash = checkedCents(commissionCash.filter((row) => row.status === "pending" && row.kind === "payment").reduce((sum, row) => sum + BigInt(row.amountCents), BigInt(0)));
  assertPaymentCapacity(commission.amountCents, settledCents(commissionCash) + commissionOffsets.confirmed, pendingCash + commissionOffsets.reserved, input.amountCents);
  return { advance, commission };
}
export async function prepareOffset(raw: unknown) {
  const input = offsetInput.parse(raw);
  assertOccurredByToday(input.occurredOn);
  return financialTransaction("erp_prepare_finance", async (tx, auth) => {
    const [existing] = await tx.select().from(schema.erpOffsets).where(and(eq(schema.erpOffsets.tenantId, auth.context.tenantId), eq(schema.erpOffsets.requestId, input.requestId))).limit(1);
    if (existing) { await sources(tx, auth, existing.advanceEntryId, existing.commissionEntryId); return existing.id; }
    await assertOffsetCapacity(tx, auth, input);
    const id = crypto.randomUUID(); await tx.insert(schema.erpOffsets).values({ id, tenantId: auth.context.tenantId, ...input, createdBy: auth.context.userId });
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.offset.prepared", entityType: "erp_offset", entityId: id, metadata: { advanceEntryId: input.advanceEntryId, commissionEntryId: input.commissionEntryId, amountCents: input.amountCents } });
    return id;
  });
}
export async function prepareOffsetReversal(raw: unknown) {
  const input = z.object({ id: z.string().uuid(), requestId: z.string().uuid(), occurredOn: z.iso.date(), reason: z.string().trim().min(5).max(300) }).strict().parse(raw);
  assertOccurredByToday(input.occurredOn);
  return financialTransaction("erp_prepare_finance", async (tx, auth) => {
    const [original] = await tx.select().from(schema.erpOffsets).where(and(eq(schema.erpOffsets.tenantId, auth.context.tenantId), eq(schema.erpOffsets.id, input.id))).limit(1).for("update");
    if (!original || original.kind !== "allocation" || original.status !== "confirmed") throw new ErpError("Compensação confirmada não encontrada.");
    const { advance, commission } = await sources(tx, auth, original.advanceEntryId, original.commissionEntryId);
    const [prior] = await tx.select().from(schema.erpOffsets).where(and(eq(schema.erpOffsets.tenantId, auth.context.tenantId), eq(schema.erpOffsets.reversesId, original.id), ne(schema.erpOffsets.status, "rejected"))).limit(1);
    if (prior) { requireSameRequest(prior, input.requestId); return prior.id; }
    if (input.occurredOn < original.occurredOn) throw new ErpError("O estorno não pode anteceder a compensação.");
    await assertOpenPeriods(tx, auth.context.tenantId, [advance.competence, commission.competence, original.occurredOn, input.occurredOn]);
    const id = crypto.randomUUID(); await tx.insert(schema.erpOffsets).values({ id, tenantId: auth.context.tenantId, advanceEntryId: advance.id, commissionEntryId: commission.id, requestId: input.requestId, amountCents: original.amountCents, occurredOn: input.occurredOn, reason: input.reason, kind: "reversal", reversesId: original.id, createdBy: auth.context.userId });
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.offset.reversal_prepared", entityType: "erp_offset", entityId: id, metadata: { reversesId: original.id } });
    return id;
  });
}
export async function reviewOffset(raw: unknown) {
  const input = z.object({ id: z.string().uuid(), decision: z.enum(["confirm", "reject"]), reason: z.string().trim().min(5).max(300) }).strict().parse(raw);
  return financialTransaction("erp_approve_finance", async (tx, auth) => {
    const [row] = await tx.select().from(schema.erpOffsets).where(and(eq(schema.erpOffsets.tenantId, auth.context.tenantId), eq(schema.erpOffsets.id, input.id))).limit(1).for("update");
    if (!row || row.status !== "pending") throw new ErpError("Compensação pendente não encontrada.");
    assertIndependentReview(auth.context.userId, row.createdBy);
    const { advance, commission } = await sources(tx, auth, row.advanceEntryId, row.commissionEntryId);
    await assertOpenPeriods(tx, auth.context.tenantId, [advance.competence, commission.competence, row.occurredOn]);
    if (input.decision === "confirm" && row.kind === "allocation") {
      // Remove only this pending reservation from the capacity check; all other requests stay reserved.
      const [advanceCash, commissionCash, advanceOffsets, commissionOffsets] = await Promise.all([entryMovements(tx, auth.context.tenantId, advance.id), entryMovements(tx, auth.context.tenantId, commission.id), getEntryOffsets(tx, auth.context.tenantId, advance.id), getEntryOffsets(tx, auth.context.tenantId, commission.id)]);
      const reversing = advanceCash.filter((movement) => movement.status === "pending" && movement.kind === "reversal").reduce((sum, movement) => sum + movement.amountCents, 0);
      assertPaymentCapacity(settledCents(advanceCash) - reversing, advanceOffsets.confirmed, advanceOffsets.reserved - row.amountCents, row.amountCents);
      const reservedCash = commissionCash.filter((movement) => movement.status === "pending" && movement.kind === "payment").reduce((sum, movement) => sum + movement.amountCents, 0);
      assertPaymentCapacity(commission.amountCents, settledCents(commissionCash) + commissionOffsets.confirmed, commissionOffsets.reserved - row.amountCents + reservedCash, row.amountCents);
    }
    if (input.decision === "confirm" && row.kind === "reversal") {
      const [original] = await tx.select().from(schema.erpOffsets).where(and(eq(schema.erpOffsets.tenantId, auth.context.tenantId), eq(schema.erpOffsets.id, row.reversesId ?? ""))).limit(1);
      if (!original || original.status !== "confirmed" || original.kind !== "allocation" || original.amountCents !== row.amountCents) throw new ErpError("A compensação de origem não corresponde ao estorno.");
      await assertOpenPeriods(tx, auth.context.tenantId, [original.occurredOn]);
    }
    await tx.update(schema.erpOffsets).set({ status: input.decision === "confirm" ? "confirmed" : "rejected", reviewedBy: auth.context.userId, reviewedAt: new Date() }).where(and(eq(schema.erpOffsets.tenantId, auth.context.tenantId), eq(schema.erpOffsets.id, row.id)));
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: `erp.offset.${input.decision}`, entityType: "erp_offset", entityId: row.id, metadata: { reason: input.reason } });
    return row.id;
  });
}

export async function getOffsets() {
  const auth = await requireErpAccess("finance", "erp_view_finance"); const db = getDatabase(); const access = await getErpEffectiveAccess(auth.context);
  const agency = canSeeAgencyBooks(auth.context) && auth.scope.mode !== "owners";
  const rows = await db.select({ id: schema.erpOffsets.id, advanceEntryId: schema.erpOffsets.advanceEntryId, commissionEntryId: schema.erpOffsets.commissionEntryId, kind: schema.erpOffsets.kind, amountCents: schema.erpOffsets.amountCents, occurredOn: schema.erpOffsets.occurredOn, status: schema.erpOffsets.status, createdBy: schema.erpOffsets.createdBy, reason: schema.erpOffsets.reason })
    .from(schema.erpOffsets).innerJoin(schema.erpFinancialEntries, and(eq(schema.erpFinancialEntries.tenantId, auth.context.tenantId), eq(schema.erpFinancialEntries.id, schema.erpOffsets.commissionEntryId)))
    .where(and(eq(schema.erpOffsets.tenantId, auth.context.tenantId), erpScopeSql(auth.scope, schema.erpFinancialEntries.branchId, schema.erpFinancialEntries.ownerId))).orderBy(desc(schema.erpOffsets.createdAt)).limit(100);
  const choices = agency ? await db.select({ id: schema.erpFinancialEntries.id, reference: schema.erpFinancialEntries.reference, kind: schema.erpFinancialEntries.kind }).from(schema.erpFinancialEntries).where(and(eq(schema.erpFinancialEntries.tenantId, auth.context.tenantId), eq(schema.erpFinancialEntries.status, "approved"), or(eq(schema.erpFinancialEntries.kind, "advance"), eq(schema.erpFinancialEntries.kind, "broker_commission")), erpScopeSql(auth.scope, schema.erpFinancialEntries.branchId, schema.erpFinancialEntries.ownerId))).orderBy(desc(schema.erpFinancialEntries.createdAt)).limit(500) : [];
  await auditErp(db, { tenantId: auth.context.tenantId, actorId: auth.context.viewAs?.adminUserId ?? auth.context.userId, action: "erp.offset.viewed", entityType: "erp_access", entityId: "offsets", metadata: { count: rows.length } });
  return { choices, canPrepare: agency && !auth.context.viewAs && access.capabilities.has("erp_prepare_finance"), rows: rows.map(({ createdBy, reason, ...row }) => ({ ...row, reason: agency ? reason : null, canReview: agency && !auth.context.viewAs && access.capabilities.has("erp_approve_finance") && createdBy !== auth.context.userId && row.status === "pending" })) };
}

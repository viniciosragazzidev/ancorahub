import "server-only";
import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase, schema } from "@/shared/db";
import { auditErp, canSeeAgencyBooks, erpScopeSql, getErpEffectiveAccess, requireErpAccess, type ErpDatabase } from "./access";
import { assertIndependentReview, ErpError } from "./contracts";
import { deterministicUuid } from "./commission-core";
import { activePayoutFor, assertOpenPeriods, entryMovements, financialTransaction } from "./finance";
import { assertOccurredByToday, assertPaymentCapacity, checkedCents, settledCents } from "./ledger";
import { getEntryOffsets } from "./offset-balances";
import { scopedEvidence, scopedFinancialEntry, type ErpAccess } from "./records";
import { syncLegacyInstallment } from "./legacy-sync";

const uuid = z.string().uuid();
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const PAYOUT_STATUS_LABELS: Record<string, string> = { prepared: "Aguardando aprovação", approved: "Aprovado para pagamento", paying: "Pagamento a conferir", settled: "Liquidado", cancelled: "Cancelado" };

export const receiptSchema = z.object({
  version: z.literal(1), number: z.string(), issuedAt: z.string(), competence: period, occurredOn: z.string(),
  beneficiary: z.object({ id: z.string(), name: z.string() }), branchName: z.string().nullable(), issuer: z.object({ id: z.string(), name: z.string() }),
  items: z.array(z.object({ entryId: z.string(), reference: z.string(), description: z.string(), amountCents: z.number().int(), previouslySettledCents: z.number().int(), offsetCents: z.number().int(), paidCents: z.number().int() })),
  grossCents: z.number().int(), offsetCents: z.number().int(), netCents: z.number().int(),
});
export type PayoutReceipt = z.infer<typeof receiptSchema>;

/** Remaining commission balance: amount − confirmed cash − confirmed offsets − pending reservations. */
async function entryBalance(db: ErpDatabase, tenantId: string, entry: { id: string; amountCents: number }) {
  const [movements, offsets] = await Promise.all([entryMovements(db, tenantId, entry.id), getEntryOffsets(db, tenantId, entry.id)]);
  const confirmed = settledCents(movements) + offsets.confirmed;
  const reserved = checkedCents(movements.filter((row) => row.status === "pending" && row.kind === "payment").reduce((sum, row) => sum + BigInt(row.amountCents), BigInt(0))) + offsets.reserved;
  return { movements, offsets, confirmedCash: settledCents(movements), confirmedOffsets: offsets.confirmed, reserved, balance: entry.amountCents - confirmed - reserved };
}

function agencyOnly(auth: ErpAccess) {
  if (!canSeeAgencyBooks(auth.context) || auth.scope.mode === "owners") throw new ErpError("Repasses exigem delegação financeira para a unidade ou empresa.");
}

async function scopedPayout(db: ErpDatabase, auth: ErpAccess, id: string, lock = false) {
  const query = db.select().from(schema.erpPayouts).where(and(eq(schema.erpPayouts.tenantId, auth.context.tenantId), eq(schema.erpPayouts.id, id), erpScopeSql(auth.scope, schema.erpPayouts.branchId, schema.erpPayouts.beneficiaryId))).limit(1);
  const [payout] = lock ? await query.for("update") : await query;
  if (!payout) throw new ErpError("Repasse não encontrado no seu escopo.");
  return payout;
}

async function payoutItems(db: ErpDatabase, tenantId: string, payoutId: string) {
  return db.select({ entryId: schema.erpPayoutItems.entryId, balanceCents: schema.erpPayoutItems.balanceCents, entry: schema.erpFinancialEntries }).from(schema.erpPayoutItems)
    .innerJoin(schema.erpFinancialEntries, and(eq(schema.erpFinancialEntries.tenantId, tenantId), eq(schema.erpFinancialEntries.id, schema.erpPayoutItems.entryId)))
    .where(and(eq(schema.erpPayoutItems.tenantId, tenantId), eq(schema.erpPayoutItems.payoutId, payoutId))).orderBy(asc(schema.erpFinancialEntries.reference));
}

/** Approved commissions with balance, grouped by beneficiary, that are not in another open payout. */
export async function getPayoutCandidates(raw: unknown) {
  const input = z.object({ competence: period.optional() }).parse(raw);
  const auth = await requireErpAccess("finance", "erp_prepare_finance"); agencyOnly(auth); const db = getDatabase();
  const entries = await db.select({ entry: schema.erpFinancialEntries, beneficiaryName: schema.user.name }).from(schema.erpFinancialEntries).leftJoin(schema.user, eq(schema.user.id, schema.erpFinancialEntries.beneficiaryId))
    .where(and(eq(schema.erpFinancialEntries.tenantId, auth.context.tenantId), eq(schema.erpFinancialEntries.kind, "broker_commission"), eq(schema.erpFinancialEntries.status, "approved"), isNotNull(schema.erpFinancialEntries.beneficiaryId),
      erpScopeSql(auth.scope, schema.erpFinancialEntries.branchId, schema.erpFinancialEntries.ownerId), input.competence ? eq(schema.erpFinancialEntries.competence, input.competence) : undefined,
      sql`NOT EXISTS (SELECT 1 FROM erp_payout_items i JOIN erp_payouts p ON p.tenant_id = i.tenant_id AND p.id = i.payout_id WHERE i.tenant_id = ${auth.context.tenantId} AND i.entry_id = ${schema.erpFinancialEntries.id} AND p.status IN ('prepared','approved','paying'))`))
    .orderBy(asc(schema.user.name), asc(schema.erpFinancialEntries.dueOn)).limit(500);
  const groups = new Map<string, { beneficiaryId: string; name: string; items: { id: string; reference: string; description: string; competence: string; dueOn: string; amountCents: number; balanceCents: number }[] }>();
  for (const { entry, beneficiaryName } of entries) {
    const balance = await entryBalance(db, auth.context.tenantId, entry);
    if (balance.balance <= 0 || !entry.beneficiaryId) continue;
    const group = groups.get(entry.beneficiaryId) ?? { beneficiaryId: entry.beneficiaryId, name: beneficiaryName ?? "Sem nome", items: [] };
    group.items.push({ id: entry.id, reference: entry.reference, description: entry.description, competence: entry.competence, dueOn: entry.dueOn, amountCents: entry.amountCents, balanceCents: balance.balance });
    groups.set(entry.beneficiaryId, group);
  }
  return { competence: input.competence ?? null, groups: [...groups.values()] };
}

const prepareSchema = z.object({ requestId: uuid, beneficiaryId: z.string().trim().min(1).max(100), competence: period, entryIds: z.array(uuid).min(1).max(200).refine((ids) => new Set(ids).size === ids.length, "Itens repetidos.") }).strict();
export async function preparePayout(raw: unknown) {
  const input = prepareSchema.parse(raw);
  return financialTransaction("erp_prepare_finance", async (tx, auth) => {
    agencyOnly(auth);
    const [existing] = await tx.select({ id: schema.erpPayouts.id, beneficiaryId: schema.erpPayouts.beneficiaryId }).from(schema.erpPayouts).where(and(eq(schema.erpPayouts.tenantId, auth.context.tenantId), eq(schema.erpPayouts.requestId, input.requestId))).limit(1);
    if (existing) { if (existing.beneficiaryId !== input.beneficiaryId) throw new ErpError("A identificação desta operação já foi usada."); return existing.id; }
    await assertOpenPeriods(tx, auth.context.tenantId, [input.competence]);
    let gross = BigInt(0); let net = BigInt(0); let branchId: string | null | undefined; const items: { entryId: string; balanceCents: number }[] = [];
    for (const entryId of [...input.entryIds].sort()) {
      const entry = await scopedFinancialEntry(tx, auth, entryId, true);
      if (entry.kind !== "broker_commission" || entry.status !== "approved" || entry.beneficiaryId !== input.beneficiaryId) throw new ErpError("O repasse aceita apenas comissões aprovadas do mesmo beneficiário.");
      if (await activePayoutFor(tx, auth.context.tenantId, entry.id)) throw new ErpError(`A comissão ${entry.reference} já está em outro repasse em andamento.`);
      if (branchId !== undefined && branchId !== entry.branchId) throw new ErpError("Prepare um repasse por unidade.");
      branchId = entry.branchId;
      const balance = await entryBalance(tx, auth.context.tenantId, entry);
      if (balance.reserved > 0) throw new ErpError(`A comissão ${entry.reference} possui liquidação ou compensação aguardando revisão.`);
      if (balance.balance <= 0) throw new ErpError(`A comissão ${entry.reference} não possui saldo a repassar.`);
      gross += BigInt(entry.amountCents); net += BigInt(balance.balance); items.push({ entryId: entry.id, balanceCents: balance.balance });
    }
    const id = crypto.randomUUID();
    await tx.insert(schema.erpPayouts).values({ id, tenantId: auth.context.tenantId, requestId: input.requestId, beneficiaryId: input.beneficiaryId, branchId: branchId ?? null, competence: input.competence,
      grossCents: checkedCents(gross), netCents: checkedCents(net), preparedBy: auth.context.userId });
    await tx.insert(schema.erpPayoutItems).values(items.map((item) => ({ tenantId: auth.context.tenantId, payoutId: id, ...item })));
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.payout.prepared", entityType: "erp_payout", entityId: id, metadata: { beneficiaryId: input.beneficiaryId, competence: input.competence, items: items.length, netCents: checkedCents(net) } });
    return id;
  });
}

async function assertItemsUnchanged(db: ErpDatabase, tenantId: string, payoutId: string) {
  for (const item of await payoutItems(db, tenantId, payoutId)) {
    if (item.entry.status !== "approved") throw new ErpError(`A comissão ${item.entry.reference} não está mais aprovada. Cancele e prepare um novo repasse.`);
    const balance = await entryBalance(db, tenantId, item.entry);
    if (balance.reserved > 0 || balance.balance !== item.balanceCents) throw new ErpError(`O saldo da comissão ${item.entry.reference} mudou. Cancele e prepare um novo repasse.`);
  }
}

const reviewSchema = z.object({ id: uuid, expectedVersion: z.number().int().positive(), decision: z.enum(["approve", "cancel"]), reason: z.string().trim().min(5).max(300) }).strict();
export async function reviewPayout(raw: unknown) {
  const input = reviewSchema.parse(raw);
  return financialTransaction(input.decision === "approve" ? "erp_approve_finance" : "erp_prepare_finance", async (tx, auth) => {
    agencyOnly(auth);
    const payout = await scopedPayout(tx, auth, input.id, true);
    if (payout.version !== input.expectedVersion) throw new ErpError("O repasse mudou. Atualize e confira novamente.");
    if (input.decision === "approve") {
      if (payout.status !== "prepared") throw new ErpError("Somente um repasse aguardando aprovação pode ser aprovado.");
      assertIndependentReview(auth.context.userId, payout.preparedBy);
      await assertOpenPeriods(tx, auth.context.tenantId, [payout.competence]);
      await assertItemsUnchanged(tx, auth.context.tenantId, payout.id);
      await tx.update(schema.erpPayouts).set({ status: "approved", approvedBy: auth.context.userId, approvedAt: new Date(), reason: input.reason, version: payout.version + 1 }).where(and(eq(schema.erpPayouts.tenantId, auth.context.tenantId), eq(schema.erpPayouts.id, payout.id)));
    } else {
      if (!["prepared", "approved"].includes(payout.status)) throw new ErpError("Um repasse com pagamento registrado não pode ser cancelado. Rejeite a conferência do pagamento primeiro.");
      await tx.delete(schema.erpPayoutItems).where(and(eq(schema.erpPayoutItems.tenantId, auth.context.tenantId), eq(schema.erpPayoutItems.payoutId, payout.id)));
      await tx.update(schema.erpPayouts).set({ status: "cancelled", reason: input.reason, version: payout.version + 1 }).where(and(eq(schema.erpPayouts.tenantId, auth.context.tenantId), eq(schema.erpPayouts.id, payout.id)));
    }
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: `erp.payout.${input.decision}`, entityType: "erp_payout", entityId: payout.id, metadata: { reason: input.reason, version: payout.version + 1 } });
    return payout.id;
  });
}

const paymentSchema = z.object({ id: uuid, expectedVersion: z.number().int().positive(), requestId: uuid, occurredOn: z.iso.date(), evidenceDocumentId: uuid, reason: z.string().trim().min(5).max(300) }).strict();
/** Records that the approved payout was paid (proof attached). Creates one pending settlement per item; nothing moves money. */
export async function registerPayoutPayment(raw: unknown) {
  const input = paymentSchema.parse(raw);
  assertOccurredByToday(input.occurredOn);
  return financialTransaction("erp_prepare_finance", async (tx, auth) => {
    agencyOnly(auth);
    const payout = await scopedPayout(tx, auth, input.id, true);
    if (payout.status === "paying" && payout.paidBy) return payout.id;
    if (payout.version !== input.expectedVersion) throw new ErpError("O repasse mudou. Atualize e confira novamente.");
    if (payout.status !== "approved") throw new ErpError("Registre o pagamento somente de um repasse aprovado.");
    await assertOpenPeriods(tx, auth.context.tenantId, [payout.competence, input.occurredOn]);
    const evidence = await scopedEvidence(tx, auth, input.evidenceDocumentId, { entryId: "payout" });
    if (evidence.financialEntryId !== null || evidence.ownerId !== payout.beneficiaryId) throw new ErpError("Use o comprovante enviado para este repasse.");
    await assertItemsUnchanged(tx, auth.context.tenantId, payout.id);
    for (const item of await payoutItems(tx, auth.context.tenantId, payout.id)) {
      const balance = await entryBalance(tx, auth.context.tenantId, item.entry);
      assertPaymentCapacity(item.entry.amountCents, balance.confirmedCash + balance.confirmedOffsets, balance.reserved, item.balanceCents);
      await tx.insert(schema.erpSettlements).values({ id: crypto.randomUUID(), tenantId: auth.context.tenantId, entryId: item.entryId, requestId: deterministicUuid(`erp:payout:${input.requestId}:${item.entryId}`),
        amountCents: item.balanceCents, occurredOn: input.occurredOn, evidenceDocumentId: evidence.id, reason: input.reason, createdBy: auth.context.userId, payoutId: payout.id });
    }
    await tx.update(schema.erpPayouts).set({ status: "paying", paidBy: auth.context.userId, occurredOn: input.occurredOn, evidenceDocumentId: evidence.id, version: payout.version + 1 }).where(and(eq(schema.erpPayouts.tenantId, auth.context.tenantId), eq(schema.erpPayouts.id, payout.id)));
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.payout.payment_registered", entityType: "erp_payout", entityId: payout.id, metadata: { occurredOn: input.occurredOn, evidenceId: evidence.id, netCents: payout.netCents } });
    return payout.id;
  });
}

async function nextReceiptNumber(db: ErpDatabase, tenantId: string, year: string) {
  const [row] = await db.select({ value: sql<number>`count(*)::int` }).from(schema.erpPayouts).where(and(eq(schema.erpPayouts.tenantId, tenantId), isNotNull(schema.erpPayouts.receiptNumber), sql`${schema.erpPayouts.receiptNumber} LIKE ${`RP-${year}-%`}`));
  return `RP-${year}-${String((row?.value ?? 0) + 1).padStart(6, "0")}`;
}

const confirmSchema = z.object({ id: uuid, expectedVersion: z.number().int().positive(), decision: z.enum(["confirm", "reject"]), reason: z.string().trim().min(5).max(300) }).strict();
/** Independent review of the registered payment; confirming settles every item and issues the versioned receipt. */
export async function confirmPayoutPayment(raw: unknown) {
  const input = confirmSchema.parse(raw);
  return financialTransaction("erp_approve_finance", async (tx, auth) => {
    agencyOnly(auth);
    const payout = await scopedPayout(tx, auth, input.id, true);
    if (payout.version !== input.expectedVersion) throw new ErpError("O repasse mudou. Atualize e confira novamente.");
    if (payout.status !== "paying" || !payout.paidBy || !payout.occurredOn || !payout.evidenceDocumentId) throw new ErpError("Não há pagamento registrado para conferir.");
    assertIndependentReview(auth.context.userId, payout.paidBy);
    await assertOpenPeriods(tx, auth.context.tenantId, [payout.competence, payout.occurredOn]);
    const movements = await tx.select().from(schema.erpSettlements).where(and(eq(schema.erpSettlements.tenantId, auth.context.tenantId), eq(schema.erpSettlements.payoutId, payout.id), eq(schema.erpSettlements.status, "pending"))).for("update");
    if (input.decision === "reject") {
      if (movements.length) await tx.update(schema.erpSettlements).set({ status: "rejected", reviewedBy: auth.context.userId, reviewedAt: new Date() }).where(and(eq(schema.erpSettlements.tenantId, auth.context.tenantId), inArray(schema.erpSettlements.id, movements.map((row) => row.id))));
      await tx.update(schema.erpPayouts).set({ status: "approved", paidBy: null, occurredOn: null, evidenceDocumentId: null, reason: input.reason, version: payout.version + 1 }).where(and(eq(schema.erpPayouts.tenantId, auth.context.tenantId), eq(schema.erpPayouts.id, payout.id)));
      await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.payout.payment_rejected", entityType: "erp_payout", entityId: payout.id, metadata: { reason: input.reason } });
      return payout.id;
    }
    const items = await payoutItems(tx, auth.context.tenantId, payout.id);
    if (movements.length !== items.length) throw new ErpError("Os pagamentos registrados não correspondem aos itens do repasse.");
    const receiptItems: PayoutReceipt["items"] = [];
    for (const item of items) {
      const movement = movements.find((row) => row.entryId === item.entryId);
      if (!movement || movement.amountCents !== item.balanceCents) throw new ErpError(`O pagamento da comissão ${item.entry.reference} não confere com o repasse.`);
      const before = await entryBalance(tx, auth.context.tenantId, item.entry);
      assertPaymentCapacity(item.entry.amountCents, before.confirmedCash + before.confirmedOffsets, before.reserved - movement.amountCents, movement.amountCents);
      await tx.update(schema.erpSettlements).set({ status: "confirmed", reviewedBy: auth.context.userId, reviewedAt: new Date() }).where(and(eq(schema.erpSettlements.tenantId, auth.context.tenantId), eq(schema.erpSettlements.id, movement.id)));
      receiptItems.push({ entryId: item.entryId, reference: item.entry.reference, description: item.entry.description, amountCents: item.entry.amountCents, previouslySettledCents: before.confirmedCash, offsetCents: before.confirmedOffsets, paidCents: movement.amountCents });
      await syncLegacyInstallment(tx, auth.context.tenantId, auth.context.userId, item.entry, before.confirmedCash + before.confirmedOffsets + movement.amountCents);
    }
    const people = await tx.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, [payout.beneficiaryId, auth.context.userId]));
    const [branch] = payout.branchId ? await tx.select({ name: schema.branches.name }).from(schema.branches).where(and(eq(schema.branches.tenantId, auth.context.tenantId), eq(schema.branches.id, payout.branchId))).limit(1) : [];
    const number = await nextReceiptNumber(tx, auth.context.tenantId, payout.occurredOn.slice(0, 4));
    const receipt: PayoutReceipt = { version: 1, number, issuedAt: new Date().toISOString(), competence: payout.competence, occurredOn: payout.occurredOn,
      beneficiary: { id: payout.beneficiaryId, name: people.find((person) => person.id === payout.beneficiaryId)?.name ?? "Beneficiário" }, branchName: branch?.name ?? null,
      issuer: { id: auth.context.userId, name: people.find((person) => person.id === auth.context.userId)?.name ?? "Financeiro" }, items: receiptItems,
      grossCents: payout.grossCents, offsetCents: receiptItems.reduce((sum, row) => sum + row.offsetCents, 0), netCents: payout.netCents };
    const digest = createHash("sha256").update(JSON.stringify({ ...receipt, issuedAt: undefined })).digest("hex");
    await tx.update(schema.erpPayouts).set({ status: "settled", settledBy: auth.context.userId, settledAt: new Date(), receipt, receiptNumber: number, receiptDigest: digest, reason: input.reason, version: payout.version + 1 })
      .where(and(eq(schema.erpPayouts.tenantId, auth.context.tenantId), eq(schema.erpPayouts.id, payout.id)));
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.payout.settled", entityType: "erp_payout", entityId: payout.id, metadata: { receiptNumber: number, digest, netCents: payout.netCents } });
    return payout.id;
  });
}

const listSchema = z.object({ status: z.enum(["all", "prepared", "approved", "paying", "settled", "cancelled"]).default("all"), competence: period.optional() });
export async function getPayouts(raw: unknown) {
  const filters = listSchema.parse(raw);
  const auth = await requireErpAccess("finance", "erp_view_finance"); const db = getDatabase();
  const agency = canSeeAgencyBooks(auth.context) && auth.scope.mode !== "owners"; const access = await getErpEffectiveAccess(auth.context);
  const rows = await db.select({ payout: schema.erpPayouts, beneficiaryName: schema.user.name }).from(schema.erpPayouts).leftJoin(schema.user, eq(schema.user.id, schema.erpPayouts.beneficiaryId))
    .where(and(eq(schema.erpPayouts.tenantId, auth.context.tenantId), erpScopeSql(auth.scope, schema.erpPayouts.branchId, schema.erpPayouts.beneficiaryId),
      agency ? undefined : eq(schema.erpPayouts.beneficiaryId, auth.context.userId), agency ? undefined : eq(schema.erpPayouts.status, "settled"),
      filters.status === "all" ? undefined : eq(schema.erpPayouts.status, filters.status), filters.competence ? eq(schema.erpPayouts.competence, filters.competence) : undefined))
    .orderBy(desc(schema.erpPayouts.createdAt)).limit(100);
  await auditErp(db, { tenantId: auth.context.tenantId, actorId: auth.context.viewAs?.adminUserId ?? auth.context.userId, action: "erp.payout.viewed", entityType: "erp_access", entityId: "payouts", metadata: { count: rows.length } });
  return { filters, agency, canPrepare: agency && !auth.context.viewAs && access.capabilities.has("erp_prepare_finance"),
    rows: rows.map(({ payout, beneficiaryName }) => ({ id: payout.id, beneficiaryName: beneficiaryName ?? "Sem nome", competence: payout.competence, status: payout.status, netCents: payout.netCents, grossCents: payout.grossCents, receiptNumber: payout.receiptNumber, occurredOn: payout.occurredOn })) };
}

export async function getPayout(id: string) {
  uuid.parse(id); const auth = await requireErpAccess("finance", "erp_view_finance"); const db = getDatabase();
  const agency = canSeeAgencyBooks(auth.context) && auth.scope.mode !== "owners"; const access = await getErpEffectiveAccess(auth.context);
  const payout = await scopedPayout(db, auth, id);
  if (!agency && (payout.beneficiaryId !== auth.context.userId || payout.status !== "settled")) throw new ErpError("Repasse não encontrado no seu escopo.");
  const items = await payoutItems(db, auth.context.tenantId, payout.id);
  const [beneficiary] = await db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, payout.beneficiaryId)).limit(1);
  const documents = agency && ["approved", "paying"].includes(payout.status) ? await db.select({ id: schema.erpDocuments.id, fileName: schema.erpDocuments.fileName }).from(schema.erpDocuments)
    .where(and(eq(schema.erpDocuments.tenantId, auth.context.tenantId), eq(schema.erpDocuments.moduleKey, "finance"), eq(schema.erpDocuments.state, "ready"), eq(schema.erpDocuments.ownerId, payout.beneficiaryId), sql`${schema.erpDocuments.financialEntryId} IS NULL`)).orderBy(desc(schema.erpDocuments.createdAt)).limit(20) : [];
  await auditErp(db, { tenantId: auth.context.tenantId, actorId: auth.context.viewAs?.adminUserId ?? auth.context.userId, action: "erp.payout.detail_viewed", entityType: "erp_payout", entityId: payout.id });
  const editable = agency && !auth.context.viewAs;
  return { id: payout.id, status: payout.status, version: payout.version, competence: payout.competence, beneficiaryName: beneficiary?.name ?? "Sem nome", grossCents: payout.grossCents, netCents: payout.netCents,
    occurredOn: payout.occurredOn, reason: agency ? payout.reason : null, receiptNumber: payout.receiptNumber, agency, documents,
    items: items.map((item) => ({ entryId: item.entryId, reference: item.entry.reference, description: item.entry.description, amountCents: item.entry.amountCents, balanceCents: item.balanceCents })),
    canApprove: editable && access.capabilities.has("erp_approve_finance") && payout.status === "prepared" && payout.preparedBy !== auth.context.userId,
    canCancel: editable && access.capabilities.has("erp_prepare_finance") && ["prepared", "approved"].includes(payout.status),
    canRegisterPayment: editable && access.capabilities.has("erp_prepare_finance") && payout.status === "approved",
    canConfirmPayment: editable && access.capabilities.has("erp_approve_finance") && payout.status === "paying" && payout.paidBy !== auth.context.userId };
}

/** Receipt: authenticated, audited, own-only for personal profiles. Not a bank proof or invoice. */
export async function getReceipt(id: string) {
  uuid.parse(id); const auth = await requireErpAccess("finance", "erp_view_finance"); const db = getDatabase();
  const payout = await scopedPayout(db, auth, id);
  const agency = canSeeAgencyBooks(auth.context) && auth.scope.mode !== "owners";
  if (payout.status !== "settled" || !payout.receipt || (!agency && payout.beneficiaryId !== auth.context.userId)) throw new ErpError("Recibo não encontrado no seu escopo.");
  await auditErp(db, { tenantId: auth.context.tenantId, actorId: auth.context.viewAs?.adminUserId ?? auth.context.userId, action: "erp.receipt.viewed", entityType: "erp_payout", entityId: payout.id, metadata: { receiptNumber: payout.receiptNumber } });
  return { receipt: receiptSchema.parse(payout.receipt), digest: payout.receiptDigest ?? "" };
}

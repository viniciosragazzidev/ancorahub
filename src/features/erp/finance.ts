import "server-only";
import { and, count, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase, schema } from "@/shared/db";
import { auditErp, canSeeAgencyBooks, erpScopeSql, getErpEffectiveAccess, requireErpAccess, type ErpDatabase, type ErpTransaction } from "./access";
import { ErpError, FINANCIAL_KINDS, assertIndependentReview, assertNotBeneficiary, financialInputSchema, settlementInputSchema } from "./contracts";
import { assertOccurredByToday, assertPaymentCapacity, checkedCents, requireSameRequest, settledCents } from "./ledger";
import { scopedEvidence, scopedFinancialEntry, type ErpAccess } from "./records";
import { scopeIncludes } from "./scope";
import { getEntryOffsets } from "./offset-balances";
import { syncLegacyInstallment } from "./legacy-sync";

export async function activePayoutFor(db: ErpDatabase, tenantId: string, entryId: string) {
  const [row] = await db.select({ id: schema.erpPayouts.id }).from(schema.erpPayoutItems).innerJoin(schema.erpPayouts, and(eq(schema.erpPayouts.tenantId, tenantId), eq(schema.erpPayouts.id, schema.erpPayoutItems.payoutId)))
    .where(and(eq(schema.erpPayoutItems.tenantId, tenantId), eq(schema.erpPayoutItems.entryId, entryId), inArray(schema.erpPayouts.status, ["prepared", "approved", "paying"]))).limit(1);
  return row?.id ?? null;
}

const uuid = z.string().uuid();
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const reviewSchema = z.object({ id: uuid, expectedVersion: z.number().int().positive(), decision: z.enum(["approve", "reject"]), reason: z.string().trim().min(5).max(300) }).strict();

export async function lockErpTenant(tx: ErpTransaction, tenantId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`erp:${tenantId}`}, 0))`);
}
export async function financialTransaction<T>(capability: "erp_prepare_finance" | "erp_approve_finance", work: (tx: ErpTransaction, auth: ErpAccess) => Promise<T>) {
  // Resolve the authenticated session before reserving a pooled transaction socket.
  const initial = await requireErpAccess("finance", capability);
  return getDatabase().transaction(async (tx) => {
    await lockErpTenant(tx, initial.context.tenantId);
    const auth = await requireErpAccess("finance", capability, tx);
    return work(tx, auth);
  });
}
export async function assertOpenPeriods(db: ErpDatabase, tenantId: string, values: readonly string[]) {
  const periods = [...new Set(values.map((value) => period.parse(value.slice(0, 7))))];
  const [closed] = await db.select({ competence: schema.erpClosings.competence }).from(schema.erpClosings)
    .where(and(eq(schema.erpClosings.tenantId, tenantId), eq(schema.erpClosings.status, "closed"), inArray(schema.erpClosings.competence, periods))).limit(1);
  if (closed) throw new ErpError(`O período ${closed.competence} está fechado. Solicite uma reabertura justificada.`);
}
export async function resolveEntryParties(db: ErpDatabase, auth: ErpAccess, input: z.infer<typeof financialInputSchema>) {
  let branchId = input.branchId; let ownerId = input.beneficiaryId ?? auth.context.userId;
  if (input.saleId) {
    const [sale] = await db.select({ id: schema.sales.id, brokerId: schema.sales.brokerId, branchId: schema.leads.branchId, status: schema.sales.status }).from(schema.sales)
      .innerJoin(schema.leads, and(eq(schema.leads.id, schema.sales.leadId), eq(schema.leads.tenantId, auth.context.tenantId), isNull(schema.leads.deletedAt)))
      .where(and(eq(schema.sales.id, input.saleId), eq(schema.sales.tenantId, auth.context.tenantId), erpScopeSql(auth.scope, schema.leads.branchId, schema.sales.brokerId))).limit(1);
    if (!sale || sale.status !== "active") throw new ErpError("Venda ativa não encontrada no seu escopo.");
    if (input.branchId && input.branchId !== sale.branchId) throw new ErpError("A unidade deve ser a mesma do negócio vinculado.");
    if (input.kind === "broker_commission" && input.beneficiaryId !== sale.brokerId) throw new ErpError("A comissão deve pertencer ao corretor da venda. Repasses diferentes exigem regra validada.");
    branchId = sale.branchId; ownerId = input.kind === "broker_commission" ? sale.brokerId : input.beneficiaryId ?? sale.brokerId;
  }
  if (branchId) {
    const [branch] = await db.select({ id: schema.branches.id }).from(schema.branches).where(and(eq(schema.branches.id, branchId), eq(schema.branches.tenantId, auth.context.tenantId), eq(schema.branches.status, "active"))).limit(1);
    if (!branch) throw new ErpError("Unidade inválida para esta empresa.");
  }
  if (input.beneficiaryId) {
    const [member] = await db.select({ id: schema.tenantMemberships.userId, branchId: schema.tenantMemberships.branchId }).from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, auth.context.tenantId), eq(schema.tenantMemberships.userId, input.beneficiaryId), eq(schema.tenantMemberships.status, "active"))).limit(1);
    if (!member || !scopeIncludes(auth.scope, { branchId: member.branchId, ownerId: member.id })) throw new ErpError("Beneficiário não encontrado no seu escopo.");
    if (!input.saleId) {
      if (branchId && branchId !== member.branchId) throw new ErpError("Confira a unidade do beneficiário.");
      branchId = member.branchId;
    }
  }
  if (!scopeIncludes(auth.scope, { branchId, ownerId })) throw new ErpError("Lançamento fora do seu escopo.");
  return { branchId, ownerId };
}

/** `preparedBy` is the person who authored the values (e.g. the import author), kept apart from the approver. */
export async function prepareFinancialEntryInTransaction(tx: ErpTransaction, auth: ErpAccess, raw: unknown, originCommissionId: string | null = null, preparedBy: string = auth.context.userId) {
  const input = financialInputSchema.parse(raw);
  const [existing] = await tx.select({ id: schema.erpFinancialEntries.id, requestId: schema.erpFinancialEntries.requestId }).from(schema.erpFinancialEntries)
    .where(and(eq(schema.erpFinancialEntries.tenantId, auth.context.tenantId), or(eq(schema.erpFinancialEntries.requestId, input.requestId), and(eq(schema.erpFinancialEntries.reference, input.reference), eq(schema.erpFinancialEntries.kind, input.kind))))).limit(1);
  if (existing) { requireSameRequest(existing, input.requestId); await scopedFinancialEntry(tx, auth, existing.id); return existing.id; }
  await assertOpenPeriods(tx, auth.context.tenantId, [input.competence]);
  const parties = await resolveEntryParties(tx, auth, input); const id = crypto.randomUUID();
  // Evidence is uploaded against the newly created entry, then checked at approval.
  if (input.evidenceDocumentId) throw new ErpError("Prepare o lançamento e envie a evidência na ficha financeira.");
  await tx.insert(schema.erpFinancialEntries).values({ id, tenantId: auth.context.tenantId, ...input, ...parties, originCommissionId, createdBy: preparedBy });
  await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.finance.prepared", entityType: "erp_financial_entry", entityId: id, metadata: { kind: input.kind, amountCents: input.amountCents, competence: input.competence, source: originCommissionId ? "legacy_schedule_conferred" : "conferred" } });
  return id;
}
export async function prepareFinancialEntry(raw: unknown) { return financialTransaction("erp_prepare_finance", (tx, auth) => prepareFinancialEntryInTransaction(tx, auth, raw)); }

export async function reviewFinancialEntry(raw: unknown) {
  const input = reviewSchema.parse(raw);
  return financialTransaction("erp_approve_finance", async (tx, auth) => {
    const entry = await scopedFinancialEntry(tx, auth, input.id, true);
    if (entry.version !== input.expectedVersion) throw new ErpError("O lançamento mudou. Atualize e confira novamente.");
    if (entry.status !== "submitted") throw new ErpError("Este lançamento já foi revisado.");
    assertIndependentReview(auth.context.userId, entry.createdBy);
    if (input.decision === "approve") assertNotBeneficiary(auth.context.userId, entry.beneficiaryId);
    await assertOpenPeriods(tx, auth.context.tenantId, [entry.competence]);
    if (input.decision === "approve") {
      if (!entry.evidenceDocumentId) throw new ErpError("A aprovação exige evidência do valor conferido.");
      await scopedEvidence(tx, auth, entry.evidenceDocumentId, { entryId: entry.id });
      // Resolve the authoritative sale and beneficiary again after the preparation.
      await resolveEntryParties(tx, auth, financialInputSchema.parse({ requestId: entry.requestId, reference: entry.reference, kind: entry.kind, saleId: entry.saleId, branchId: entry.branchId, beneficiaryId: entry.beneficiaryId, amountCents: entry.amountCents, dueOn: entry.dueOn, competence: entry.competence, description: entry.description, evidenceDocumentId: entry.evidenceDocumentId }));
    }
    await tx.update(schema.erpFinancialEntries).set({ status: input.decision === "approve" ? "approved" : "rejected", approvedBy: auth.context.userId, approvedAt: new Date(), version: entry.version + 1 })
      .where(and(eq(schema.erpFinancialEntries.id, entry.id), eq(schema.erpFinancialEntries.tenantId, auth.context.tenantId)));
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: `erp.finance.${input.decision}`, entityType: "erp_financial_entry", entityId: entry.id, metadata: { reason: input.reason, version: entry.version + 1 } });
    return entry.id;
  });
}
export async function entryMovements(db: ErpDatabase, tenantId: string, entryId: string) {
  return db.select().from(schema.erpSettlements).where(and(eq(schema.erpSettlements.tenantId, tenantId), eq(schema.erpSettlements.entryId, entryId)));
}
export async function prepareSettlement(raw: unknown) {
  const input = settlementInputSchema.parse(raw);
  assertOccurredByToday(input.occurredOn);
  return financialTransaction("erp_prepare_finance", async (tx, auth) => {
    const entry = await scopedFinancialEntry(tx, auth, input.entryId, true);
    const [existing] = await tx.select({ id: schema.erpSettlements.id, entryId: schema.erpSettlements.entryId }).from(schema.erpSettlements)
      .where(and(eq(schema.erpSettlements.tenantId, auth.context.tenantId), eq(schema.erpSettlements.requestId, input.requestId))).limit(1);
    if (existing) { if (existing.entryId !== entry.id) throw new ErpError("A identificação desta operação já foi usada."); return existing.id; }
    if (entry.status !== "approved") throw new ErpError("A liquidação exige um lançamento aprovado.");
    if (await activePayoutFor(tx, auth.context.tenantId, entry.id)) throw new ErpError("Este lançamento está em um repasse em andamento. Registre a liquidação pelo repasse.");
    await assertOpenPeriods(tx, auth.context.tenantId, [entry.competence, input.occurredOn]);
    await scopedEvidence(tx, auth, input.evidenceDocumentId, { entryId: entry.id });
    const movements = await entryMovements(tx, auth.context.tenantId, entry.id);
    const offsets = await getEntryOffsets(tx, auth.context.tenantId, entry.id);
    const reserved = checkedCents(movements.filter((row) => row.status === "pending" && row.kind === "payment").reduce((total, row) => total + BigInt(row.amountCents), BigInt(0)));
    assertPaymentCapacity(entry.amountCents, settledCents(movements) + (entry.kind === "broker_commission" ? offsets.confirmed : 0), reserved + (entry.kind === "broker_commission" ? offsets.reserved : 0), input.amountCents);
    const id = crypto.randomUUID(); await tx.insert(schema.erpSettlements).values({ id, tenantId: auth.context.tenantId, ...input, createdBy: auth.context.userId });
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.settlement.prepared", entityType: "erp_settlement", entityId: id, metadata: { entryId: entry.id, amountCents: input.amountCents, occurredOn: input.occurredOn } });
    return id;
  });
}
export async function prepareSettlementReversal(raw: unknown) {
  const input = z.object({ settlementId: uuid, requestId: uuid, occurredOn: z.iso.date(), evidenceDocumentId: uuid, reason: z.string().trim().min(5).max(300) }).strict().parse(raw);
  assertOccurredByToday(input.occurredOn);
  return financialTransaction("erp_prepare_finance", async (tx, auth) => {
    const [original] = await tx.select().from(schema.erpSettlements).where(and(eq(schema.erpSettlements.id, input.settlementId), eq(schema.erpSettlements.tenantId, auth.context.tenantId))).limit(1).for("update");
    if (!original) throw new ErpError("Liquidação não encontrada.");
    const entry = await scopedFinancialEntry(tx, auth, original.entryId, true);
    const [prior] = await tx.select().from(schema.erpSettlements).where(and(eq(schema.erpSettlements.tenantId, auth.context.tenantId), eq(schema.erpSettlements.reversesId, original.id), ne(schema.erpSettlements.status, "rejected"))).limit(1);
    if (prior) { requireSameRequest(prior, input.requestId); return prior.id; }
    if (original.status !== "confirmed" || original.kind !== "payment") throw new ErpError("Somente uma liquidação confirmada pode ser estornada.");
    // A payout reversal keeps the link: the receipt stays as issued and shows the reversed amount; the commission becomes payable again.
    if (input.occurredOn < original.occurredOn) throw new ErpError("O estorno não pode anteceder a liquidação.");
    await assertOpenPeriods(tx, auth.context.tenantId, [entry.competence, original.occurredOn, input.occurredOn]);
    await scopedEvidence(tx, auth, input.evidenceDocumentId, { entryId: entry.id });
    if (entry.kind === "advance") {
      const offsets = await getEntryOffsets(tx, auth.context.tenantId, entry.id);
      const cash = settledCents(await entryMovements(tx, auth.context.tenantId, entry.id));
      if (cash - original.amountCents < offsets.confirmed + offsets.reserved) throw new ErpError("Reverta as compensações vinculadas antes de estornar o adiantamento.");
    }
    const id = crypto.randomUUID(); await tx.insert(schema.erpSettlements).values({ id, tenantId: auth.context.tenantId, entryId: entry.id, requestId: input.requestId, payoutId: original.payoutId, kind: "reversal", reversesId: original.id, amountCents: original.amountCents, occurredOn: input.occurredOn, evidenceDocumentId: input.evidenceDocumentId, reason: input.reason, createdBy: auth.context.userId });
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.settlement.reversal_prepared", entityType: "erp_settlement", entityId: id, metadata: { reversesId: original.id, amountCents: original.amountCents } });
    return id;
  });
}
export async function reviewSettlement(raw: unknown) {
  const input = z.object({ id: uuid, decision: z.enum(["confirm", "reject"]), reason: z.string().trim().min(5).max(300) }).strict().parse(raw);
  return financialTransaction("erp_approve_finance", async (tx, auth) => {
    const [movement] = await tx.select().from(schema.erpSettlements).where(and(eq(schema.erpSettlements.id, input.id), eq(schema.erpSettlements.tenantId, auth.context.tenantId))).limit(1).for("update");
    if (!movement) throw new ErpError("Liquidação não encontrada.");
    const entry = await scopedFinancialEntry(tx, auth, movement.entryId, true);
    if (movement.status !== "pending") throw new ErpError("Esta liquidação já foi revisada.");
    if (movement.payoutId && movement.kind === "payment") throw new ErpError("Esta liquidação pertence a um repasse. Confira-a pela tela do repasse.");
    if (input.decision === "confirm") assertNotBeneficiary(auth.context.userId, entry.beneficiaryId);
    assertIndependentReview(auth.context.userId, movement.createdBy);
    await assertOpenPeriods(tx, auth.context.tenantId, [entry.competence, movement.occurredOn]);
    if (input.decision === "confirm") {
      if (entry.status !== "approved") throw new ErpError("O lançamento não está aprovado.");
      await scopedEvidence(tx, auth, movement.evidenceDocumentId, { entryId: entry.id });
      const movements = await entryMovements(tx, auth.context.tenantId, entry.id);
      const offsets = await getEntryOffsets(tx, auth.context.tenantId, entry.id);
      if (movement.kind === "payment") assertPaymentCapacity(entry.amountCents, settledCents(movements) + (entry.kind === "broker_commission" ? offsets.confirmed : 0), 0, movement.amountCents);
      else {
        const original = movements.find((row) => row.id === movement.reversesId && row.kind === "payment" && row.status === "confirmed");
        if (!original || original.amountCents !== movement.amountCents || settledCents(movements) < movement.amountCents) throw new ErpError("O estorno não corresponde a uma liquidação confirmada disponível.");
        await assertOpenPeriods(tx, auth.context.tenantId, [original.occurredOn]);
        if (entry.kind === "advance" && settledCents(movements) - movement.amountCents < offsets.confirmed + offsets.reserved) throw new ErpError("O adiantamento possui compensações vinculadas. Confira os estornos antes de prosseguir.");
      }
    }
    await tx.update(schema.erpSettlements).set({ status: input.decision === "confirm" ? "confirmed" : "rejected", reviewedBy: auth.context.userId, reviewedAt: new Date() })
      .where(and(eq(schema.erpSettlements.id, movement.id), eq(schema.erpSettlements.tenantId, auth.context.tenantId)));
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: `erp.settlement.${input.decision}`, entityType: "erp_settlement", entityId: movement.id, metadata: { entryId: entry.id, reason: input.reason, kind: movement.kind } });
    if (input.decision === "confirm" && entry.kind === "broker_commission") {
      const offsets = await getEntryOffsets(tx, auth.context.tenantId, entry.id);
      await syncLegacyInstallment(tx, auth.context.tenantId, auth.context.userId, entry, settledCents(await entryMovements(tx, auth.context.tenantId, entry.id)) + offsets.confirmed);
    }
    return entry.id;
  });
}

const filtersSchema = z.object({ kind: z.enum(["all", ...FINANCIAL_KINDS]).default("all"), status: z.enum(["all", "submitted", "approved", "rejected"]).default("all"), competence: period.optional(), page: z.coerce.number().int().min(1).max(10000).default(1) });
export async function getFinancialEntries(raw: unknown) {
  const filters = filtersSchema.parse(raw); const auth = await requireErpAccess("finance", "erp_view_finance"); const db = getDatabase();
  const agency = canSeeAgencyBooks(auth.context) && auth.scope.mode !== "owners";
  const conditions = and(eq(schema.erpFinancialEntries.tenantId, auth.context.tenantId), erpScopeSql(auth.scope, schema.erpFinancialEntries.branchId, schema.erpFinancialEntries.ownerId),
    agency ? undefined : inArray(schema.erpFinancialEntries.kind, ["broker_commission", "advance"]), !agency && auth.scope.mode !== "owners" ? eq(schema.erpFinancialEntries.status, "approved") : undefined, filters.kind === "all" ? undefined : eq(schema.erpFinancialEntries.kind, filters.kind), filters.status === "all" ? undefined : eq(schema.erpFinancialEntries.status, filters.status), filters.competence ? eq(schema.erpFinancialEntries.competence, filters.competence) : undefined);
  const [rows, total, access] = await Promise.all([
    db.select().from(schema.erpFinancialEntries).where(conditions).orderBy(desc(schema.erpFinancialEntries.createdAt), schema.erpFinancialEntries.id).limit(25).offset((filters.page - 1) * 25),
    db.select({ value: count() }).from(schema.erpFinancialEntries).where(conditions), getErpEffectiveAccess(auth.context),
  ]);
  const ids = rows.map((row) => row.id);
  const movements = ids.length ? await db.select().from(schema.erpSettlements).where(and(eq(schema.erpSettlements.tenantId, auth.context.tenantId), inArray(schema.erpSettlements.entryId, ids))) : [];
  const offsets = ids.length ? await db.select().from(schema.erpOffsets).where(and(eq(schema.erpOffsets.tenantId, auth.context.tenantId), inArray(schema.erpOffsets.commissionEntryId, ids))) : [];
  await auditErp(db, { tenantId: auth.context.tenantId, actorId: auth.context.viewAs?.adminUserId ?? auth.context.userId, action: "erp.finance.viewed", entityType: "erp_access", entityId: "financial_entries", metadata: { count: rows.length, page: filters.page } });
  return { filters, total: Number(total[0]?.value ?? 0), agency, canPrepare: agency && !auth.context.viewAs && access.capabilities.has("erp_prepare_finance"), rows: rows.map((row) => ({ id: row.id, kind: z.enum(FINANCIAL_KINDS).parse(row.kind), reference: row.reference, description: row.description, amountCents: row.amountCents, dueOn: row.dueOn, competence: row.competence, status: row.status, version: row.version, settledCents: settledCents(movements.filter((movement) => movement.entryId === row.id)) + (row.kind === "broker_commission" ? settledCents(offsets.filter((offset) => offset.commissionEntryId === row.id)) : 0) })) };
}
export async function getFinancialEntry(id: string) {
  uuid.parse(id); const auth = await requireErpAccess("finance", "erp_view_finance"); const db = getDatabase(); const entry = await scopedFinancialEntry(db, auth, id);
  const agency = canSeeAgencyBooks(auth.context) && auth.scope.mode !== "owners"; const access = await getErpEffectiveAccess(auth.context);
  const movements = await entryMovements(db, auth.context.tenantId, id);
  const offsets = await getEntryOffsets(db, auth.context.tenantId, id);
  const documents = agency ? await db.select({ id: schema.erpDocuments.id, fileName: schema.erpDocuments.fileName }).from(schema.erpDocuments)
    .where(and(eq(schema.erpDocuments.tenantId, auth.context.tenantId), eq(schema.erpDocuments.financialEntryId, id), eq(schema.erpDocuments.state, "ready"))) : [];
  await auditErp(db, { tenantId: auth.context.tenantId, actorId: auth.context.viewAs?.adminUserId ?? auth.context.userId, action: "erp.finance.entry_viewed", entityType: "erp_financial_entry", entityId: id });
  return { entry: { id: entry.id, kind: z.enum(FINANCIAL_KINDS).parse(entry.kind), reference: entry.reference, description: entry.description, amountCents: entry.amountCents, dueOn: entry.dueOn, competence: entry.competence, status: entry.status, version: entry.version, evidenceDocumentId: agency ? entry.evidenceDocumentId : null },
    documents, settledCents: settledCents(movements) + (entry.kind === "broker_commission" ? offsets.confirmed : 0), cashCents: settledCents(movements), offsetCents: offsets.confirmed, agency,
    canPrepare: agency && !auth.context.viewAs && access.capabilities.has("erp_prepare_finance"), canApprove: agency && !auth.context.viewAs && access.capabilities.has("erp_approve_finance") && entry.createdBy !== auth.context.userId,
    movements: movements.map((row) => ({ id: row.id, kind: row.kind, amountCents: row.amountCents, occurredOn: row.occurredOn, status: row.status,
      evidenceDocumentId: agency ? row.evidenceDocumentId : null, reason: agency ? row.reason : null,
      canReview: agency && !auth.context.viewAs && access.capabilities.has("erp_approve_finance") && row.createdBy !== auth.context.userId && row.status === "pending" })) };
}

export async function getFinanceSelectors() {
  const auth = await requireErpAccess("finance", "erp_prepare_finance"); const db = getDatabase();
  const [branches, beneficiaries, sales] = await Promise.all([
    db.select({ id: schema.branches.id, name: schema.branches.name }).from(schema.branches).where(and(eq(schema.branches.tenantId, auth.context.tenantId), eq(schema.branches.status, "active"), erpScopeSql(auth.scope, schema.branches.id, schema.branches.id))).orderBy(schema.branches.name).limit(200),
    db.select({ id: schema.user.id, name: schema.user.name, branchId: schema.tenantMemberships.branchId }).from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId)).where(and(eq(schema.tenantMemberships.tenantId, auth.context.tenantId), eq(schema.tenantMemberships.status, "active"), erpScopeSql(auth.scope, schema.tenantMemberships.branchId, schema.tenantMemberships.userId))).orderBy(schema.user.name).limit(500),
    db.select({ id: schema.sales.id, name: schema.leads.nome, brokerId: schema.sales.brokerId, branchId: schema.leads.branchId }).from(schema.sales).innerJoin(schema.leads, and(eq(schema.leads.id, schema.sales.leadId), eq(schema.leads.tenantId, auth.context.tenantId), isNull(schema.leads.deletedAt))).where(and(eq(schema.sales.tenantId, auth.context.tenantId), eq(schema.sales.status, "active"), erpScopeSql(auth.scope, schema.leads.branchId, schema.sales.brokerId))).orderBy(desc(schema.sales.createdAt)).limit(200),
  ]);
  return { branches, beneficiaries, sales };
}

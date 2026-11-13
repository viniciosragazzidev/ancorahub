import "server-only";
import { createHash } from "node:crypto";
import { and, arrayContained, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase, schema } from "@/shared/db";
import { auditErp, canSeeAgencyBooks, requireErpAccess, type ErpDatabase } from "./access";
import { ErpError, IMPLANTATION_STATUSES, assertImplantationTransition, assertIndependentReview, financialInputSchema, implantationInputSchema, parseMoneyCents, type ErpModuleKey, type FinancialKind } from "./contracts";
import { deterministicUuid } from "./commission-core";
import { assertOpenPeriods, prepareFinancialEntryInTransaction, resolveEntryParties } from "./finance";
import { scopedLead, scopedEvidence, type ErpAccess } from "./records";
import { parseImportFile, type ImportDomain } from "./import-parser";
import { saveImplantationInTransaction } from "./implantations";

const batchIdSchema = z.string().uuid();
const payloadSchema = z.object({ domain: z.literal("implantations"), rows: z.array(implantationInputSchema).min(1).max(500) }).strict();

async function importContext(domain: ImportDomain, db: ErpDatabase = getDatabase()) {
  const imports = await requireErpAccess("imports", "erp_import_data", db);
  const target = domain === "finance" ? await requireErpAccess("finance", "erp_prepare_finance", db) : await requireErpAccess("implantations", "erp_manage_operations", db);
  if (domain === "finance" && !canSeeAgencyBooks(target.context)) throw new ErpError("A importação financeira exige delegação financeira.");
  if (target.scope.mode !== "tenant" && target.scope.mode !== "units") throw new ErpError("A importação exige um cargo delegado para a unidade ou empresa.");
  return { ...target, maxRows: imports.setting.maxImportRows };
}

function batchScope(auth: ErpAccess) {
  return auth.scope.mode === "tenant" ? sql`true` : auth.scope.mode === "units"
    ? and(eq(schema.erpImports.containsUnassigned, false), arrayContained(schema.erpImports.branchIds, [...auth.scope.unitIds])) : sql`false`;
}

async function validateRows(db: ErpDatabase, auth: ErpAccess, raw: unknown, refreshVersions: boolean, preflight = false) {
  const payload = payloadSchema.parse(raw); const rows: z.infer<typeof implantationInputSchema>[] = []; const branches = new Set<string>(); let containsUnassigned = false;
  const seen = new Set<string>();
  for (const [index, candidate] of payload.rows.entries()) {
    if (seen.has(candidate.leadId)) throw new ErpError(`O negócio da linha ${index + 2} está repetido no lote.`); seen.add(candidate.leadId);
    const lead = await scopedLead(db, auth, candidate.leadId);
    if (lead.branchId) branches.add(lead.branchId); else containsUnassigned = true;
    const [current] = await db.select({ version: schema.erpImplantations.version, status: schema.erpImplantations.status }).from(schema.erpImplantations)
      .where(and(eq(schema.erpImplantations.tenantId, auth.context.tenantId), eq(schema.erpImplantations.leadId, lead.id))).limit(1);
    if (candidate.evidenceDocumentId) await scopedEvidence(db, auth, candidate.evidenceDocumentId, { leadId: lead.id });
    if (preflight) {
      assertImplantationTransition(z.enum(IMPLANTATION_STATUSES).parse(current?.status ?? "review"), candidate);
      if (!refreshVersions && candidate.expectedVersion !== (current?.version ?? 0)) throw new ErpError(`A linha ${index + 2} mudou desde a prévia. Revalide o lote.`);
      if (!["documentation_pending", "under_analysis", "converted"].includes(lead.status) && !["cancelled", "refused"].includes(candidate.status)) throw new ErpError(`O negócio da linha ${index + 2} precisa estar em fechamento.`);
      if (["cancelled", "refused"].includes(candidate.status)) {
        const [sale] = await db.select({ id: schema.sales.id }).from(schema.sales).where(and(eq(schema.sales.tenantId, auth.context.tenantId), eq(schema.sales.leadId, lead.id), eq(schema.sales.status, "active"))).limit(1);
        if (sale) throw new ErpError(`A linha ${index + 2} possui contrato ativo. Trate o cancelamento na ficha do contrato.`);
      }
    }
    rows.push({ ...candidate, expectedVersion: refreshVersions ? current?.version ?? 0 : candidate.expectedVersion });
  }
  return { payload: { domain: "implantations" as const, rows }, branchIds: [...branches], containsUnassigned };
}

const FINANCE_KIND_ALIASES: Record<string, FinancialKind> = {
  agency_receivable: "agency_receivable", recebivel: "agency_receivable", "recebivel da corretora": "agency_receivable",
  client_premium: "client_premium", mensalidade: "client_premium", "mensalidade do cliente": "client_premium",
  broker_commission: "broker_commission", comissao: "broker_commission", "comissao do corretor": "broker_commission",
  expense: "expense", despesa: "expense", advance: "advance", adiantamento: "advance",
};
const normalizedKind = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const financePayloadSchema = z.object({ domain: z.literal("finance"), rows: z.array(financialInputSchema).min(1).max(500) }).strict();
type FinanceRow = z.infer<typeof financialInputSchema>;

/** Finance rows never approve or settle: each becomes a submitted entry that still needs evidence and an independent review. */
async function validateFinanceRows(db: ErpDatabase, auth: ErpAccess, raw: unknown) {
  const payload = financePayloadSchema.parse(raw); const branches = new Set<string>(); let containsUnassigned = false; const seen = new Set<string>();
  for (const [index, row] of payload.rows.entries()) {
    const key = `${row.kind}:${row.reference}`;
    if (seen.has(key)) throw new ErpError(`A referência da linha ${index + 2} está repetida no lote.`); seen.add(key);
    const [existing] = await db.select({ id: schema.erpFinancialEntries.id }).from(schema.erpFinancialEntries)
      .where(and(eq(schema.erpFinancialEntries.tenantId, auth.context.tenantId), eq(schema.erpFinancialEntries.reference, row.reference), eq(schema.erpFinancialEntries.kind, row.kind))).limit(1);
    if (existing) throw new ErpError(`A referência da linha ${index + 2} já foi lançada. Corrija o lançamento existente na ficha financeira.`);
    await assertOpenPeriods(db, auth.context.tenantId, [row.competence]);
    const parties = await resolveEntryParties(db, auth, row);
    if (parties.branchId) branches.add(parties.branchId); else containsUnassigned = true;
  }
  return { payload: { domain: "finance" as const, rows: payload.rows }, branchIds: [...branches], containsUnassigned };
}

function financeRowsFromFile(tenantId: string, parsedRows: ReturnType<typeof parseImportFile>): FinanceRow[] {
  return parsedRows.map(({ line, values }) => {
    const kind = FINANCE_KIND_ALIASES[normalizedKind(values.tipo ?? "")];
    if (!kind) throw new ErpError(`Tipo inválido na linha ${line}. Use recebível, mensalidade, comissão, despesa ou adiantamento.`);
    let amountCents: number;
    try { amountCents = parseMoneyCents(values.valor ?? ""); } catch { throw new ErpError(`Confira o valor da linha ${line}. Use até duas casas decimais.`); }
    const row = financialInputSchema.safeParse({ requestId: deterministicUuid(`erp:import:finance:${tenantId}:${kind}:${values.referencia}`), reference: values.referencia, kind,
      saleId: values.venda_id || null, branchId: values.unidade_id || null, beneficiaryId: values.beneficiario_id || null, amountCents,
      dueOn: values.vencimento, competence: values.competencia, description: values.descricao, evidenceDocumentId: null });
    if (!row.success) throw new ErpError(`Confira os campos da linha ${line}: ${row.error.issues[0]?.message ?? "formato inválido"}.`);
    return row.data;
  });
}

export async function previewErpImport(domain: ImportDomain, file: File) {
  const auth = await importContext(domain);
  const bytes = Buffer.from(await file.arrayBuffer());
  const parsedRows = parseImportFile(bytes, file.name, domain, auth.maxRows);
  const rows = domain === "finance" ? financeRowsFromFile(auth.context.tenantId, parsedRows) : parsedRows.map(({ line, values }) => {
    const row = implantationInputSchema.safeParse({ leadId: values.negocio_id, expectedVersion: 0, status: values.etapa,
      reference: values.referencia, policyNumber: values.apolice, coverageStartsOn: values.inicio_cobertura || null,
      evidenceDocumentId: values.evidencia_id || null, reason: values.motivo });
    if (!row.success) throw new ErpError(`Confira os campos da linha ${line}. Use as etapas e datas indicadas no modelo.`);
    return row.data;
  });
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return getDatabase().transaction(async (tx) => {
    const currentAuth = await importContext(domain, tx);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`erp:${auth.context.tenantId}`}, 0))`);
    const [existing] = await tx.select({ id: schema.erpImports.id, status: schema.erpImports.status }).from(schema.erpImports)
      .where(and(eq(schema.erpImports.tenantId, auth.context.tenantId), eq(schema.erpImports.domain, domain), eq(schema.erpImports.sha256, sha256), batchScope(currentAuth))).limit(1);
    if (existing) return { id: existing.id, alreadyApplied: existing.status === "applied" };
    const validated = domain === "finance" ? await validateFinanceRows(tx, currentAuth, { domain, rows }) : await validateRows(tx, currentAuth, { domain, rows }, true, true);
    const id = crypto.randomUUID();
    await tx.insert(schema.erpImports).values({ id, tenantId: auth.context.tenantId, domain, fileName: file.name.replace(/[\r\n\\/]/g, "_").slice(0, 180),
      sha256, payload: validated.payload, rowCount: rows.length, branchIds: validated.branchIds, containsUnassigned: validated.containsUnassigned, createdBy: auth.context.userId });
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.import.previewed", entityType: "erp_import", entityId: id, metadata: { domain, rowCount: rows.length, sha256 } });
    return { id, alreadyApplied: false };
  });
}

async function availableDomains() {
  const domains: { domain: ImportDomain; auth: Awaited<ReturnType<typeof importContext>> }[] = [];
  for (const domain of ["implantations", "finance"] as const) { try { domains.push({ domain, auth: await importContext(domain) }); } catch { /* Domain not delegated to this profile. */ } }
  if (!domains.length) await importContext("implantations");
  return domains;
}

export async function getErpImports() {
  const domains = await availableDomains();
  const rows = (await Promise.all(domains.map(({ domain, auth }) => getDatabase().select({ id: schema.erpImports.id, fileName: schema.erpImports.fileName, domain: schema.erpImports.domain,
    status: schema.erpImports.status, rowCount: schema.erpImports.rowCount, createdAt: schema.erpImports.createdAt,
    createdBy: schema.user.name }).from(schema.erpImports).leftJoin(schema.user, eq(schema.erpImports.createdBy, schema.user.id))
    .where(and(eq(schema.erpImports.tenantId, auth.context.tenantId), eq(schema.erpImports.domain, domain), batchScope(auth))).orderBy(desc(schema.erpImports.createdAt)).limit(50)))).flat()
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()).slice(0, 50);
  return { rows, maxRows: Math.min(...domains.map(({ auth }) => auth.maxRows)), domains: domains.map(({ domain }) => domain) };
}

async function batchDomain(id: string) {
  const { getRequiredTenantContext } = await import("@/shared/auth/tenant-context");
  const context = await getRequiredTenantContext();
  const [row] = await getDatabase().select({ domain: schema.erpImports.domain }).from(schema.erpImports).where(and(eq(schema.erpImports.id, id), eq(schema.erpImports.tenantId, context.tenantId))).limit(1);
  if (!row || !isImportDomain(row.domain)) throw new ErpError("Lote não encontrado no seu escopo.");
  return row.domain;
}

export async function getErpImport(id: string) {
  batchIdSchema.parse(id);
  const domain = await batchDomain(id);
  const auth = await importContext(domain);
  const [batch] = await getDatabase().select().from(schema.erpImports).where(and(eq(schema.erpImports.id, id), eq(schema.erpImports.tenantId, auth.context.tenantId), eq(schema.erpImports.domain, domain), batchScope(auth))).limit(1);
  if (!batch) throw new ErpError("Lote não encontrado no seu escopo.");
  const base = { id, fileName: batch.fileName, status: z.enum(["preview", "applied", "rejected"]).parse(batch.status),
    createdAt: batch.createdAt, version: batch.version, createdBy: batch.createdBy, reviewReason: batch.reviewReason, canApprove: auth.context.userId !== batch.createdBy };
  const result = domain === "finance"
    ? { ...base, domain: "finance" as const, rows: [] as z.infer<typeof implantationInputSchema>[], financeRows: (batch.status === "applied" ? financePayloadSchema.parse(batch.payload) : (await validateFinanceRows(getDatabase(), auth, batch.payload)).payload).rows }
    : { ...base, domain: "implantations" as const, rows: (await validateRows(getDatabase(), auth, batch.payload, false)).payload.rows, financeRows: [] as FinanceRow[] };
  await auditErp(getDatabase(), { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.import.viewed", entityType: "erp_import", entityId: id, metadata: { domain, count: result.rows.length + result.financeRows.length } });
  return result;
}

export async function reviewErpImport(raw: unknown) {
  const input = z.object({ id: batchIdSchema, version: z.number().int().positive(), decision: z.enum(["apply", "reject", "refresh"]), reason: z.string().trim().min(5).max(300), confirmed: z.boolean() }).strict().parse(raw);
  const domain = await batchDomain(input.id);
  await importContext(domain);
  return getDatabase().transaction(async (tx) => {
    const initial = await importContext(domain, tx);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`erp:${initial.context.tenantId}`}, 0))`);
    const auth = await importContext(domain, tx);
    const [batch] = await tx.select().from(schema.erpImports).where(and(eq(schema.erpImports.id, input.id), eq(schema.erpImports.tenantId, auth.context.tenantId), eq(schema.erpImports.domain, domain), batchScope(auth))).limit(1).for("update");
    if (!batch) throw new ErpError("Lote não encontrado no seu escopo.");
    if (batch.status === "applied") { if (input.decision === "apply") return batch.id; throw new ErpError("Um lote aplicado não pode ser alterado. Corrija os fatos no módulo de origem."); }
    if (batch.version !== input.version) throw new ErpError("A prévia mudou. Reabra o lote para conferir a versão atual.");
    if (input.decision === "apply") {
      if (!input.confirmed) throw new ErpError("Confirme que conferiu todas as linhas antes de aplicar.");
      assertIndependentReview(auth.context.userId, batch.createdBy);
      if (batch.status !== "preview") throw new ErpError("Revalide o lote antes de aplicar.");
      if (domain === "finance") {
        const valid = await validateFinanceRows(tx, auth, batch.payload);
        for (const row of [...valid.payload.rows].sort((left, right) => left.reference.localeCompare(right.reference))) await prepareFinancialEntryInTransaction(tx, auth, row, null, batch.createdBy);
      } else {
        const valid = await validateRows(tx, auth, batch.payload, false, true);
        for (const row of [...valid.payload.rows].sort((left, right) => left.leadId.localeCompare(right.leadId))) await saveImplantationInTransaction(tx, auth, row, true);
      }
    }
    const refreshed = input.decision === "refresh" ? domain === "finance" ? await validateFinanceRows(tx, auth, batch.payload) : await validateRows(tx, auth, batch.payload, true, true) : null;
    await tx.update(schema.erpImports).set({ status: input.decision === "apply" ? "applied" : input.decision === "reject" ? "rejected" : "preview",
      reviewedBy: input.decision === "refresh" ? null : auth.context.userId, reviewedAt: input.decision === "refresh" ? null : new Date(),
      reviewReason: input.reason, version: batch.version + 1, ...(refreshed ? refreshed : {}) })
      .where(and(eq(schema.erpImports.id, batch.id), eq(schema.erpImports.tenantId, auth.context.tenantId)));
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: `erp.import.${input.decision}`, entityType: "erp_import", entityId: batch.id, metadata: { domain, rowCount: batch.rowCount, version: batch.version + 1 } });
    return batch.id;
  });
}

export function isImportDomain(value: string): value is ImportDomain { return value === "implantations" || value === "finance"; }
export function importModule(domain: ImportDomain): ErpModuleKey { return domain === "finance" ? "finance" : "implantations"; }

import "server-only";
import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase, schema } from "@/shared/db";
import { auditActor, auditErp, erpScopeSql, getErpEffectiveAccess, requireErpAccess, type ErpTransaction } from "./access";
import { ErpError, IMPLANTATION_STATUSES, assertImplantationTransition, implantationInputSchema, type ImplantationStatus } from "./contracts";
import { PAGE_SIZE, pageSchema } from "./shared";
import { scopedEvidence, scopedLead, type ErpAccess } from "./records";
import { canAccessRoute } from "@/features/custom-roles/effective-access";
import { getRouteDefinition } from "@/features/custom-roles/routes";

export const implantationFiltersSchema = z.object({
  q: z.string().trim().max(100).default(""),
  status: z.enum(["all", ...IMPLANTATION_STATUSES]).default("all"),
  page: pageSchema,
});

export const CLOSING_LEAD_STATUSES: readonly string[] = ["documentation_pending", "under_analysis", "converted"];
const HISTORY_PER_ROW = 5;
const historyMetadataSchema = z.object({
  after: z.object({ status: z.enum(IMPLANTATION_STATUSES) }).passthrough().optional(),
  reviewedImport: z.boolean().optional(),
}).passthrough();
export type ImplantationHistoryItem = { id: string; createdAt: Date; actor: string | null; status: ImplantationStatus | null; reviewedImport: boolean };

export async function getImplantations(rawFilters: unknown) {
  const filters = implantationFiltersSchema.parse(rawFilters);
  const auth = await requireErpAccess("implantations", "erp_view_operations");
  const db = getDatabase();
  const tenantId = auth.context.tenantId;
  const stageSql = sql<string>`coalesce(${schema.erpImplantations.status}, 'review')`;
  const search = filters.q
    ? or(ilike(schema.leads.nome, `%${filters.q}%`), ilike(schema.erpImplantations.policyNumber, `%${filters.q}%`),
      ilike(schema.erpImplantations.reference, `%${filters.q}%`))
    : undefined;
  const base = and(eq(schema.leads.tenantId, tenantId), isNull(schema.leads.deletedAt),
    erpScopeSql(auth.scope, schema.leads.branchId, schema.leads.corretorId),
    or(inArray(schema.leads.status, ["documentation_pending", "under_analysis", "converted"]), eq(schema.erpImplantations.tenantId, tenantId)), search);
  const conditions = filters.status === "all" ? base : and(base, eq(stageSql, filters.status));
  const join = and(eq(schema.erpImplantations.leadId, schema.leads.id), eq(schema.erpImplantations.tenantId, tenantId));
  const [rows, totals, stageCounts] = await Promise.all([
    db.select({
      leadId: schema.leads.id, name: schema.leads.nome, branchId: schema.leads.branchId, brokerId: schema.leads.corretorId, brokerName: schema.user.name,
      implantationId: schema.erpImplantations.id, stage: schema.erpImplantations.status, reference: schema.erpImplantations.reference,
      policyNumber: schema.erpImplantations.policyNumber, coverageStartsOn: schema.erpImplantations.coverageStartsOn,
      evidenceId: schema.erpImplantations.evidenceDocumentId, reason: schema.erpImplantations.reason,
      version: schema.erpImplantations.version, updatedAt: schema.erpImplantations.updatedAt,
    })
      .from(schema.leads).leftJoin(schema.erpImplantations, join).leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId))
      .where(conditions).orderBy(desc(schema.leads.updatedAt), schema.leads.id).limit(PAGE_SIZE).offset((filters.page - 1) * PAGE_SIZE),
    db.select({ value: count() }).from(schema.leads).leftJoin(schema.erpImplantations, join).where(conditions),
    db.select({ stage: stageSql, value: count() }).from(schema.leads).leftJoin(schema.erpImplantations, join).where(base).groupBy(stageSql),
  ]);
  const capabilities = await getErpEffectiveAccess(auth.context);
  const leadIds = rows.map((row) => row.leadId);
  const implantationIds = rows.flatMap((row) => row.implantationId ? [row.implantationId] : []);
  const [evidence, nativeDocuments, events] = await Promise.all([
    leadIds.length
      ? db.select({ id: schema.erpDocuments.id, leadId: schema.erpDocuments.leadId, fileName: schema.erpDocuments.fileName }).from(schema.erpDocuments)
        .where(and(eq(schema.erpDocuments.tenantId, tenantId), eq(schema.erpDocuments.moduleKey, "implantations"), eq(schema.erpDocuments.state, "ready"),
          inArray(schema.erpDocuments.leadId, leadIds)))
      : [],
    leadIds.length && capabilities.capabilities.has("acessar_documentos")
      ? db.select({ id: schema.leadDocuments.id, leadId: schema.leadDocuments.leadId, fileName: schema.leadDocuments.filename }).from(schema.leadDocuments)
        .where(and(eq(schema.leadDocuments.tenantId, tenantId), inArray(schema.leadDocuments.leadId, leadIds), eq(schema.leadDocuments.status, "approved"),
          isNull(schema.leadDocuments.deletedAt)))
      : [],
    implantationIds.length
      ? db.select({ id: schema.erpEvents.id, entityId: schema.erpEvents.entityId, metadata: schema.erpEvents.metadata, createdAt: schema.erpEvents.createdAt,
        actor: schema.user.name })
        .from(schema.erpEvents).leftJoin(schema.user, eq(schema.erpEvents.actorId, schema.user.id))
        .where(and(eq(schema.erpEvents.tenantId, tenantId), eq(schema.erpEvents.entityType, "erp_implantation"), inArray(schema.erpEvents.entityId, implantationIds)))
        .orderBy(desc(schema.erpEvents.createdAt)).limit(implantationIds.length * HISTORY_PER_ROW * 2)
      : [],
  ]);
  const history = groupHistory(events);
  const counts = Object.fromEntries(IMPLANTATION_STATUSES.map((status) => [status, 0])) as Record<ImplantationStatus, number>;
  for (const row of stageCounts) {
    const stage = z.enum(IMPLANTATION_STATUSES).safeParse(row.stage);
    if (stage.success) counts[stage.data] = Number(row.value);
  }
  await auditErp(db, { tenantId, actorId: auditActor(auth.context), action: "erp.implantations.viewed", entityType: "erp_access", entityId: "implantations",
    metadata: { count: rows.length, page: filters.page, status: filters.status } });
  return {
    filters, total: Number(totals[0]?.value ?? 0), pageSize: PAGE_SIZE, counts, evidence, nativeDocuments,
    canManage: !auth.context.viewAs && capabilities.capabilities.has("erp_manage_operations"),
    canApproveDocument: capabilities.capabilities.has("aprovar_documentos"),
    rows: rows.map((row) => ({
      ...row, stage: z.enum(IMPLANTATION_STATUSES).parse(row.stage ?? "review"), version: row.version ?? 0,
      history: row.implantationId ? history.get(row.implantationId) ?? [] : [],
      canOpenLead: canAccessRoute(capabilities, getRouteDefinition(`/leads/${row.leadId}`))
        && (auth.context.role !== "manager" || auth.context.branchId === row.branchId)
        && (auth.context.role !== "supervisor" || auth.context.supervisorTeamScope === true),
    })),
  };
}

function groupHistory(events: readonly { id: string; entityId: string; metadata: Record<string, unknown>; createdAt: Date; actor: string | null }[]) {
  const history = new Map<string, ImplantationHistoryItem[]>();
  for (const event of events) {
    const list = history.get(event.entityId) ?? [];
    if (list.length >= HISTORY_PER_ROW) continue;
    const metadata = historyMetadataSchema.safeParse(event.metadata);
    list.push({
      id: event.id, createdAt: event.createdAt, actor: event.actor,
      status: metadata.success ? metadata.data.after?.status ?? null : null,
      reviewedImport: metadata.success && metadata.data.reviewedImport === true,
    });
    history.set(event.entityId, list);
  }
  return history;
}

export async function saveImplantationInTransaction(tx: ErpTransaction, auth: ErpAccess, raw: unknown, reviewedImport = false) {
  const input = implantationInputSchema.parse(raw);
  const lead = await scopedLead(tx, auth, input.leadId, true);
  if (!CLOSING_LEAD_STATUSES.includes(lead.status) && !["cancelled", "refused"].includes(input.status)) throw new ErpError("O negócio precisa estar em fechamento para seguir na implantação.");
  const [current] = await tx.select().from(schema.erpImplantations).where(and(eq(schema.erpImplantations.tenantId, auth.context.tenantId), eq(schema.erpImplantations.leadId, lead.id))).for("update");
  if ((current?.version ?? 0) !== input.expectedVersion) throw new ErpError("A implantação mudou. Atualize a página e confira novamente.");
  const from = z.enum(IMPLANTATION_STATUSES).parse(current?.status ?? "review");
  assertImplantationTransition(from, input);
  const [sale] = await tx.select({ id: schema.sales.id, status: schema.sales.status, policyNumber: schema.sales.policyNumber, coverageStartsOn: schema.sales.coverageStartDate }).from(schema.sales)
    .where(and(eq(schema.sales.tenantId, auth.context.tenantId), eq(schema.sales.leadId, lead.id))).orderBy(desc(schema.sales.createdAt)).limit(1);
  if (sale?.status === "active" && ["cancelled", "refused"].includes(input.status)) throw new ErpError("Este contrato já foi registrado. Trate o cancelamento na ficha do contrato para preservar suas regras e histórico.");
  if (input.evidenceDocumentId) await scopedEvidence(tx, auth, input.evidenceDocumentId, { leadId: lead.id });
  if (input.status === "implanted" && input.evidenceDocumentId) {
    const access = await getErpEffectiveAccess(auth.context, tx);
    if (!access.capabilities.has("aprovar_documentos")) throw new ErpError("A confirmação exige também permissão para aprovar documentos.");
    if (sale && ((sale.policyNumber && sale.policyNumber !== input.policyNumber) || (sale.coverageStartsOn && sale.coverageStartsOn !== input.coverageStartsOn))) throw new ErpError("Os dados diferem do contrato registrado. Confira a ficha do contrato antes de prosseguir.");
    const document = await scopedEvidence(tx, auth, input.evidenceDocumentId, { leadId: lead.id });
    const nativeId = document.nativeDocumentId ?? document.id;
    const [existingDocument] = await tx.select({ tenantId: schema.leadDocuments.tenantId, leadId: schema.leadDocuments.leadId, status: schema.leadDocuments.status, deletedAt: schema.leadDocuments.deletedAt, storageKey: schema.leadDocuments.storageKey }).from(schema.leadDocuments).where(and(eq(schema.leadDocuments.id, nativeId), eq(schema.leadDocuments.tenantId, auth.context.tenantId))).limit(1);
    if (existingDocument && (existingDocument.tenantId !== auth.context.tenantId || existingDocument.leadId !== lead.id || existingDocument.storageKey !== document.objectKey || existingDocument.deletedAt || existingDocument.status !== "approved")) throw new ErpError("Esta evidência precisa de revisão na ficha do lead antes de ser usada novamente.");
    if (!existingDocument) await tx.insert(schema.leadDocuments).values({ id: nativeId, tenantId: auth.context.tenantId, leadId: lead.id,
      filename: document.fileName, fileUrl: `/api/documents/download?key=${encodeURIComponent(document.objectKey)}`, storageKey: document.objectKey,
      category: "contratacao", description: "Confirmação da operadora conferida no ERP", mimeType: document.contentType,
      sizeBytes: document.byteLength, checksumSha256: document.sha256, status: "approved", uploadedBy: document.createdBy,
      reviewedBy: auth.context.userId, reviewedAt: new Date(), coverageStartDate: input.coverageStartsOn });
    if (!document.nativeDocumentId) await tx.update(schema.erpDocuments).set({ nativeDocumentId: nativeId }).where(and(eq(schema.erpDocuments.id, document.id), eq(schema.erpDocuments.tenantId, auth.context.tenantId)));
    await tx.insert(schema.auditLogs).values({ id: crypto.randomUUID(), userId: auth.context.userId, entidade: "lead_document", entidadeId: document.id, acao: "erp.operator_confirmation_approved" });
  }
  const id = current?.id ?? crypto.randomUUID();
  const update = { saleId: sale?.id ?? null, branchId: lead.branchId, brokerId: lead.brokerId ?? auth.context.userId,
    status: input.status, reference: input.reference, policyNumber: input.policyNumber, coverageStartsOn: input.coverageStartsOn,
    evidenceDocumentId: input.evidenceDocumentId, reason: input.reason, version: (current?.version ?? 0) + 1, updatedBy: auth.context.userId, updatedAt: new Date() };
  await tx.insert(schema.erpImplantations).values({ id, tenantId: auth.context.tenantId, leadId: lead.id, createdBy: auth.context.userId, ...update })
    .onConflictDoUpdate({ target: [schema.erpImplantations.tenantId, schema.erpImplantations.leadId], set: update });
  await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.implantation.updated", entityType: "erp_implantation", entityId: id,
    metadata: { leadId: lead.id, before: current ? { status: current.status, version: current.version, branchId: current.branchId, brokerId: current.brokerId } : null,
      after: { status: input.status, version: update.version, branchId: update.branchId, brokerId: update.brokerId }, evidenceId: input.evidenceDocumentId, reviewedImport } });
  return id;
}

export async function saveImplantation(raw: unknown) {
  await requireErpAccess("implantations", "erp_manage_operations");
  return getDatabase().transaction(async (tx) => {
    const auth = await requireErpAccess("implantations", "erp_manage_operations", tx);
    return saveImplantationInTransaction(tx, auth, raw);
  });
}

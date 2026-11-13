import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { schema } from "@/shared/db";
import { canSeeAgencyBooks, erpScopeSql, type ErpDatabase, type requireErpAccess } from "./access";
import { ErpError } from "./contracts";
import { scopeIncludes } from "./scope";

export type ErpAccess = Awaited<ReturnType<typeof requireErpAccess>>;

export async function scopedLead(db: ErpDatabase, auth: ErpAccess, id: string, lock = false) {
  const query = db.select({ id: schema.leads.id, name: schema.leads.nome, branchId: schema.leads.branchId,
    brokerId: schema.leads.corretorId, status: schema.leads.status }).from(schema.leads)
    .where(and(eq(schema.leads.id, id), eq(schema.leads.tenantId, auth.context.tenantId), isNull(schema.leads.deletedAt), erpScopeSql(auth.scope, schema.leads.branchId, schema.leads.corretorId))).limit(1);
  const [lead] = lock ? await query.for("update") : await query;
  if (!lead) throw new ErpError("Negócio não encontrado no seu escopo.");
  return lead;
}

export async function scopedFinancialEntry(db: ErpDatabase, auth: ErpAccess, id: string, lock = false) {
  const query = db.select().from(schema.erpFinancialEntries).where(and(eq(schema.erpFinancialEntries.id, id), eq(schema.erpFinancialEntries.tenantId, auth.context.tenantId),
    erpScopeSql(auth.scope, schema.erpFinancialEntries.branchId, schema.erpFinancialEntries.ownerId),
    canSeeAgencyBooks(auth.context) && auth.scope.mode !== "owners" ? undefined : inArray(schema.erpFinancialEntries.kind, ["broker_commission", "advance"]),
    !canSeeAgencyBooks(auth.context) && auth.scope.mode !== "owners" ? eq(schema.erpFinancialEntries.status, "approved") : undefined)).limit(1);
  const [entry] = lock ? await query.for("update") : await query;
  if (!entry) throw new ErpError("Lançamento não encontrado no seu escopo.");
  return entry;
}

export async function scopedEvidence(db: ErpDatabase, auth: ErpAccess, id: string, target: { leadId?: string; entryId?: string }) {
  const [document] = await db.select().from(schema.erpDocuments).where(and(eq(schema.erpDocuments.tenantId, auth.context.tenantId), eq(schema.erpDocuments.id, id), eq(schema.erpDocuments.state, "ready"))).limit(1);
  if (!document) throw new ErpError("Evidência não encontrada no seu escopo.");
  if (target.leadId) await scopedLead(db, auth, target.leadId);
  else if (!scopeIncludes(auth.scope, { branchId: document.branchId, ownerId: document.ownerId })) throw new ErpError("Evidência não encontrada no seu escopo.");
  if (target.leadId && (document.moduleKey !== "implantations" || document.leadId !== target.leadId)) throw new ErpError("A evidência não pertence a este negócio.");
  if (target.entryId && (document.moduleKey !== "finance" || (document.financialEntryId !== null && document.financialEntryId !== target.entryId))) throw new ErpError("A evidência não pertence a este lançamento.");
  return document;
}

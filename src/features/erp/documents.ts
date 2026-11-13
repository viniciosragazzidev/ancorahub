import "server-only";
import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDatabase, schema } from "@/shared/db";
import { uploadR2Object, downloadR2Object } from "@/shared/storage/r2-storage";
import { isR2StorageEnabled } from "@/features/storage/r2-storage-feature";
import { auditErp, canSeeAgencyBooks, erpScopeSql, getErpEffectiveAccess, requireErpAccess } from "./access";
import { ErpError, recordIdSchema } from "./contracts";
import { scopedEvidence, scopedFinancialEntry, scopedLead } from "./records";

const targetSchema = z.discriminatedUnion("module", [
  z.object({ module: z.literal("implantations"), leadId: recordIdSchema, entryId: z.null(), payoutId: z.null().default(null) }).strict(),
  z.object({ module: z.literal("finance"), leadId: z.null(), entryId: z.string().uuid(), payoutId: z.null().default(null) }).strict(),
  z.object({ module: z.literal("payout"), leadId: z.null(), entryId: z.null(), payoutId: z.string().uuid() }).strict(),
]);

export function evidenceMime(bytes: Uint8Array): { mime: string; extension: string } {
  if (bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-") return { mime: "application/pdf", extension: "pdf" };
  if (bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mime: "image/png", extension: "png" };
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mime: "image/jpeg", extension: "jpg" };
  throw new ErpError("Envie um PDF, PNG ou JPEG válido de até 5 MB.");
}

export async function uploadErpEvidence(rawTarget: unknown, file: File) {
  const target = targetSchema.parse(rawTarget);
  if (!(file instanceof File) || file.size < 1 || file.size > 5 * 1024 * 1024) throw new ErpError("Envie um arquivo de até 5 MB.");
  const moduleKey = target.module === "implantations" ? "implantations" : "finance";
  const capability = moduleKey === "finance" ? "erp_prepare_finance" : "erp_manage_operations";
  const auth = await requireErpAccess(moduleKey, capability);
  if (!(await isR2StorageEnabled())) throw new ErpError("O armazenamento está desativado. Solicite a liberação ao administrador.");
  if (target.module === "implantations" && !target.leadId) throw new ErpError("Selecione o negócio da evidência.");
  const lead = target.leadId ? await scopedLead(getDatabase(), auth, target.leadId) : null;
  const entry = target.entryId ? await scopedFinancialEntry(getDatabase(), auth, target.entryId) : null;
  if (target.module === "finance" && !entry) throw new ErpError("Selecione o lançamento antes de enviar a evidência.");
  const [payout] = target.payoutId ? await getDatabase().select({ id: schema.erpPayouts.id, beneficiaryId: schema.erpPayouts.beneficiaryId, branchId: schema.erpPayouts.branchId, status: schema.erpPayouts.status }).from(schema.erpPayouts)
    .where(and(eq(schema.erpPayouts.tenantId, auth.context.tenantId), eq(schema.erpPayouts.id, target.payoutId), erpScopeSql(auth.scope, schema.erpPayouts.branchId, schema.erpPayouts.beneficiaryId))).limit(1) : [];
  if (target.module === "payout" && (!payout || payout.status !== "approved" || !canSeeAgencyBooks(auth.context) || auth.scope.mode === "owners")) throw new ErpError("Envie o comprovante de um repasse aprovado no seu escopo.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const media = evidenceMime(bytes); const id = crypto.randomUUID();
  const objectKey = `documents/${auth.context.tenantId}/erp/${id}.${media.extension}`;
  await getDatabase().transaction(async (tx) => {
    await requireErpAccess(moduleKey, capability, tx);
    await tx.insert(schema.erpDocuments).values({ id, tenantId: auth.context.tenantId, moduleKey,
      ownerId: lead?.brokerId ?? entry?.ownerId ?? payout?.beneficiaryId ?? auth.context.userId, branchId: lead?.branchId ?? entry?.branchId ?? payout?.branchId ?? null,
      leadId: lead?.id ?? null, financialEntryId: entry?.id ?? null, saleId: entry?.saleId ?? null, payoutId: payout?.id ?? null,
      objectKey, fileName: file.name.replace(/[\r\n\\/]/g, "_").slice(0, 180) || `evidencia.${media.extension}`,
      contentType: media.mime, byteLength: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex"), createdBy: auth.context.userId });
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.document.upload_started", entityType: "erp_document", entityId: id, metadata: { module: target.module, byteLength: bytes.byteLength, payoutId: payout?.id ?? null } });
  });
  await uploadR2Object(objectKey, bytes, media.mime);
  await getDatabase().transaction(async (tx) => {
    const current = await requireErpAccess(moduleKey, capability, tx);
    const currentLead = lead ? await scopedLead(tx, current, lead.id, true) : null;
    const currentEntry = entry ? await scopedFinancialEntry(tx, current, entry.id, true) : null;
    if (entry && currentEntry?.version !== entry.version) throw new ErpError("O lançamento mudou durante o envio. Confira os valores antes de anexar novamente.");
    await tx.update(schema.erpDocuments).set({ state: "ready", ...(currentLead ? { ownerId: currentLead.brokerId ?? auth.context.userId, branchId: currentLead.branchId } : {}) }).where(and(eq(schema.erpDocuments.id, id), eq(schema.erpDocuments.tenantId, auth.context.tenantId)));
    if (currentEntry?.status === "submitted") await tx.update(schema.erpFinancialEntries).set({ evidenceDocumentId: id, version: currentEntry.version + 1 }).where(and(eq(schema.erpFinancialEntries.id, currentEntry.id), eq(schema.erpFinancialEntries.tenantId, auth.context.tenantId), eq(schema.erpFinancialEntries.status, "submitted")));
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.document.uploaded", entityType: "erp_document", entityId: id, metadata: { module: target.module } });
  });
  return id;
}

export async function downloadErpEvidence(id: string) {
  z.string().uuid().parse(id);
  // Discover purpose only within this tenant; then apply its capability and resource scope.
  const { getRequiredTenantContext } = await import("@/shared/auth/tenant-context");
  const context = await getRequiredTenantContext();
  const [record] = await getDatabase().select({ module: schema.erpDocuments.moduleKey, leadId: schema.erpDocuments.leadId, entryId: schema.erpDocuments.financialEntryId }).from(schema.erpDocuments)
    .where(and(eq(schema.erpDocuments.id, id), eq(schema.erpDocuments.tenantId, context.tenantId))).limit(1);
  if (!record || !["implantations", "finance"].includes(record.module)) throw new ErpError("Evidência não encontrada.");
  const moduleKey = record.module === "finance" ? "finance" : "implantations";
  const auth = await requireErpAccess(moduleKey, moduleKey === "finance" ? "erp_view_finance" : "erp_view_operations");
  if (moduleKey === "finance" && (!canSeeAgencyBooks(context) || auth.scope.mode === "owners")) throw new ErpError("Comprovantes da corretora são restritos à conferência financeira. Consulte seu recibo pessoal.");
  if (record.leadId) await scopedLead(getDatabase(), auth, record.leadId);
  if (record.entryId) await scopedFinancialEntry(getDatabase(), auth, record.entryId);
  const document = await scopedEvidence(getDatabase(), auth, id, { leadId: record.leadId ?? undefined, entryId: record.entryId ?? undefined });
  if (!(await isR2StorageEnabled())) throw new ErpError("O armazenamento está temporariamente desativado.");
  const blob = await downloadR2Object(document.objectKey);
  await auditErp(getDatabase(), { tenantId: context.tenantId, actorId: context.viewAs?.adminUserId ?? context.userId, action: "erp.document.downloaded", entityType: "erp_document", entityId: id });
  return { blob, fileName: document.fileName, contentType: document.contentType };
}

export async function adoptNativeEvidence(leadId: string, documentId: string) {
  recordIdSchema.parse(leadId); recordIdSchema.parse(documentId);
  await requireErpAccess("implantations", "erp_manage_operations");
  return getDatabase().transaction(async (tx) => {
    const auth = await requireErpAccess("implantations", "erp_manage_operations", tx);
    const lead = await scopedLead(tx, auth, leadId, true);
    if (!(await getErpEffectiveAccess(auth.context, tx)).capabilities.has("acessar_documentos")) throw new ErpError("Seu cargo não permite consultar os documentos do negócio.");
    const [native] = await tx.select().from(schema.leadDocuments).where(and(eq(schema.leadDocuments.tenantId, auth.context.tenantId), eq(schema.leadDocuments.leadId, lead.id), eq(schema.leadDocuments.id, documentId), eq(schema.leadDocuments.status, "approved"), isNull(schema.leadDocuments.deletedAt))).limit(1).for("share");
    if (!native?.storageKey?.startsWith(`documents/${auth.context.tenantId}/`) || !native.checksumSha256 || !native.sizeBytes || !native.mimeType || !["application/pdf", "image/png", "image/jpeg"].includes(native.mimeType)) throw new ErpError("Esta versão não possui os dados necessários para reutilização. Envie uma nova evidência pela implantação.");
    const [existing] = await tx.select({ id: schema.erpDocuments.id }).from(schema.erpDocuments).where(and(eq(schema.erpDocuments.tenantId, auth.context.tenantId), eq(schema.erpDocuments.nativeDocumentId, native.id))).limit(1);
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    await tx.insert(schema.erpDocuments).values({ id, tenantId: auth.context.tenantId, moduleKey: "implantations", state: "ready", leadId: lead.id,
      ownerId: lead.brokerId ?? auth.context.userId, branchId: lead.branchId, nativeDocumentId: native.id,
      objectKey: native.storageKey, fileName: native.filename, contentType: native.mimeType, byteLength: native.sizeBytes,
      sha256: native.checksumSha256, createdBy: auth.context.userId });
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.document.adopted", entityType: "erp_document", entityId: id, metadata: { leadId: lead.id, nativeDocumentId: native.id } });
    return id;
  });
}

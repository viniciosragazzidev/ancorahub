"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { publishNotification } from "@/features/notifications/send-push-helper";

// ─── Requirements Actions ──────────────────────────────────────────────────

const requirementInput = z.object({
  carrierId: z.string().trim().nullable().optional(),
  planId: z.string().trim().nullable().optional(),
  name: z.string().trim().min(2, "Informe o nome do documento.").max(100),
  description: z.string().trim().max(250).optional(),
  required: z.coerce.boolean().optional(),
  appliesPerBeneficiary: z.coerce.boolean().optional(),
});

export type DocumentActionState = { success?: boolean; error?: string };

const documentCategory = z.enum(["identificacao", "proposta", "contratacao", "pos_venda", "outros"]);

export async function createRequirementAction(
  _previous: DocumentActionState,
  formData: FormData
): Promise<DocumentActionState> {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") return { error: "Apenas diretores podem criar requisitos." };

  const parsed = requirementInput.safeParse({
    carrierId: formData.get("carrierId") || null,
    planId: formData.get("planId") || null,
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    required: formData.get("required") === "true",
    appliesPerBeneficiary: formData.get("appliesPerBeneficiary") === "true",
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const db = getDatabase();
    await db.insert(schema.documentRequirements).values({
      id: randomUUID(),
      tenantId: context.tenantId,
      carrierId: parsed.data.carrierId || null,
      planId: parsed.data.planId || null,
      name: parsed.data.name,
      description: parsed.data.description || null,
      required: parsed.data.required ?? true,
      appliesPerBeneficiary: parsed.data.appliesPerBeneficiary ?? false,
    });

    revalidatePath("/documentos");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao criar requisito." };
  }
}

export async function deleteRequirementAction(
  requirementId: string
): Promise<DocumentActionState> {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") return { error: "Apenas diretores podem excluir requisitos." };

  try {
    const db = getDatabase();
    const result = await db
      .delete(schema.documentRequirements)
      .where(
        and(
          eq(schema.documentRequirements.id, requirementId),
          eq(schema.documentRequirements.tenantId, context.tenantId)
        )
      )
      .returning({ id: schema.documentRequirements.id });

    if (result.length === 0) return { error: "Requisito não encontrado." };
    revalidatePath("/documentos");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao excluir requisito." };
  }
}

export async function getDocumentRequirements() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  return db
    .select({
      id: schema.documentRequirements.id,
      name: schema.documentRequirements.name,
      description: schema.documentRequirements.description,
      required: schema.documentRequirements.required,
      appliesPerBeneficiary: schema.documentRequirements.appliesPerBeneficiary,
      carrierId: schema.documentRequirements.carrierId,
      carrierName: schema.carriers.name,
      planId: schema.documentRequirements.planId,
      planName: schema.carrierPlans.name,
    })
    .from(schema.documentRequirements)
    .leftJoin(schema.carriers, eq(schema.documentRequirements.carrierId, schema.carriers.id))
    .leftJoin(schema.carrierPlans, eq(schema.documentRequirements.planId, schema.carrierPlans.id))
    .where(eq(schema.documentRequirements.tenantId, context.tenantId))
    .orderBy(schema.documentRequirements.name);
}

// ─── Lead Documents Actions ────────────────────────────────────────────────

export async function getLeadDocuments(leadId: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  return db
    .select({
      id: schema.leadDocuments.id,
      filename: schema.leadDocuments.filename,
      fileUrl: schema.leadDocuments.fileUrl,
      status: schema.leadDocuments.status,
      category: schema.leadDocuments.category,
      description: schema.leadDocuments.description,
      mimeType: schema.leadDocuments.mimeType,
      sizeBytes: schema.leadDocuments.sizeBytes,
      scanStatus: schema.leadDocuments.scanStatus,
      version: schema.leadDocuments.version,
      requirementId: schema.leadDocuments.requirementId,
      beneficiaryId: schema.leadDocuments.beneficiaryId,
      requirementName: schema.documentRequirements.name,
      uploadedBy: schema.leadDocuments.uploadedBy,
      createdAt: schema.leadDocuments.createdAt,
    })
    .from(schema.leadDocuments)
    .innerJoin(schema.leads, eq(schema.leadDocuments.leadId, schema.leads.id))
    .leftJoin(schema.documentRequirements, eq(schema.leadDocuments.requirementId, schema.documentRequirements.id))
    .where(
      and(
        eq(schema.leadDocuments.leadId, leadId),
        eq(schema.leadDocuments.tenantId, context.tenantId),
        isNull(schema.leadDocuments.deletedAt),
        context.role === "broker"
          ? eq(schema.leads.corretorId, context.userId)
          : context.role === "manager" && context.branchId
            ? eq(schema.leads.branchId, context.branchId)
            : undefined,
      )
    )
    .orderBy(schema.leadDocuments.createdAt);
}

export async function confirmDocumentUploadAction({
  leadId,
  requirementId,
  beneficiaryId,
  filename,
  fileUrl,
  storageKey,
  category,
  description,
  mimeType,
  sizeBytes,
  checksumSha256,
  clientId,
}: {
  leadId: string;
  requirementId: string | null;
  beneficiaryId?: string | null;
  filename: string;
  fileUrl: string;
  storageKey?: string | null;
  category?: string;
  description?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  checksumSha256?: string | null;
  clientId?: string | null;
}): Promise<DocumentActionState> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  try {
    const parsedCategory = documentCategory.safeParse(category ?? "outros");
    if (!parsedCategory.success) return { error: "Categoria documental inválida." };
    if (!filename || filename.length > 180) return { error: "Nome de arquivo inválido." };
    if (!fileUrl.startsWith("/api/documents/download?key=")) return { error: "Referência de arquivo inválida." };

    const [lead] = await db
      .select({ id: schema.leads.id, corretorId: schema.leads.corretorId, branchId: schema.leads.branchId })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);
    if (!lead) return { error: "Lead não encontrado." };
    if (context.role === "broker" && lead.corretorId !== context.userId) {
      return { error: "Você não pode anexar documentos a este lead." };
    }
    if (context.role === "manager" && (!context.branchId || lead.branchId !== context.branchId)) {
      return { error: "Este lead não pertence à sua filial." };
    }
    if (requirementId) {
      const [requirement] = await db
        .select({ id: schema.documentRequirements.id, appliesPerBeneficiary: schema.documentRequirements.appliesPerBeneficiary })
        .from(schema.documentRequirements)
        .where(and(eq(schema.documentRequirements.id, requirementId), eq(schema.documentRequirements.tenantId, context.tenantId)))
        .limit(1);
      if (!requirement) return { error: "Requisito de documento inválido." };
    }

    if (requirementId && !beneficiaryId) {
      const [requirement] = await db.select({ appliesPerBeneficiary: schema.documentRequirements.appliesPerBeneficiary }).from(schema.documentRequirements)
        .where(and(eq(schema.documentRequirements.id, requirementId), eq(schema.documentRequirements.tenantId, context.tenantId))).limit(1);
      if (requirement?.appliesPerBeneficiary) return { error: "Selecione o beneficiario deste documento." };
    }

    if (beneficiaryId) {
      const [beneficiary] = await db.select({ id: schema.leadBeneficiaries.id }).from(schema.leadBeneficiaries).where(and(eq(schema.leadBeneficiaries.id, beneficiaryId), eq(schema.leadBeneficiaries.leadId, leadId), eq(schema.leadBeneficiaries.tenantId, context.tenantId))).limit(1);
      if (!beneficiary) return { error: "Beneficiário inválido para este lead." };
    }

    const [client] = clientId
      ? await db.select({ id: schema.clients.id, leadId: schema.clients.leadId }).from(schema.clients).where(and(eq(schema.clients.id, clientId), eq(schema.clients.leadId, leadId), eq(schema.clients.tenantId, context.tenantId))).limit(1)
      : await db.select({ id: schema.clients.id, leadId: schema.clients.leadId }).from(schema.clients).where(and(eq(schema.clients.leadId, leadId), eq(schema.clients.tenantId, context.tenantId))).limit(1);
    if (clientId && !client) return { error: "Cliente inválido para este lead." };

    await getLeadDocumentChecklist(leadId);
    const docId = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(schema.leadDocuments).values({
        id: docId,
        tenantId: context.tenantId,
        leadId,
        clientId: client?.id ?? null,
        requirementId,
        beneficiaryId: beneficiaryId || null,
        filename,
        fileUrl,
        storageKey: storageKey || null,
        category: parsedCategory.data,
        description: description?.trim().slice(0, 500) || null,
        mimeType: mimeType || null,
        sizeBytes: sizeBytes ?? null,
        checksumSha256: checksumSha256 || null,
        scanStatus: "clean",
        status: "pending",
        uploadedBy: context.userId,
      });

      if (requirementId) {
        await tx.update(schema.leadDocumentChecklist).set({ documentId: docId, status: "pending", updatedAt: new Date() }).where(and(
          eq(schema.leadDocumentChecklist.tenantId, context.tenantId),
          eq(schema.leadDocumentChecklist.leadId, leadId),
          eq(schema.leadDocumentChecklist.requirementId, requirementId),
          beneficiaryId ? eq(schema.leadDocumentChecklist.beneficiaryId, beneficiaryId) : isNull(schema.leadDocumentChecklist.beneficiaryId),
        ));
      }

      await tx.insert(schema.leadInteractions).values({
        id: randomUUID(),
        leadId,
        userId: context.userId,
        tipo: "document_upload",
        conteudo: `Documento "${filename}" enviado para aprovação.`,
        metadata: { docId },
      });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_document", entidadeId: docId, acao: "document.uploaded" });
    });

    revalidatePath(`/leads/${leadId}`);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao salvar documento." };
  }
}

export async function reviewDocumentAction({
  documentId,
  leadId,
  status,
  reviewComment,
}: {
  documentId: string;
  leadId: string;
  status: "approved" | "rejected";
  reviewComment?: string | null;
}): Promise<DocumentActionState> {
  const context = await getRequiredTenantContext();
  if (context.role === "broker") return { error: "Corretores não podem aprovar/rejeitar documentos." };

  const db = getDatabase();
  try {
    const [lead] = await db.select({ id: schema.leads.id, branchId: schema.leads.branchId })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.id, leadId),
        eq(schema.leads.tenantId, context.tenantId),
        context.role === "manager" && context.branchId ? eq(schema.leads.branchId, context.branchId) : undefined,
      ))
      .limit(1);
    if (!lead) return { error: "Este lead não pertence ao escopo da sua unidade." };
    let reviewedFileName = "";

    await db.transaction(async (tx) => {
      const [doc] = await tx
        .update(schema.leadDocuments)
        .set({
          status,
          reviewedBy: context.userId,
          reviewedAt: new Date(),
          reviewComment: reviewComment?.trim().slice(0, 500) || null,
        })
        .where(
          and(
            eq(schema.leadDocuments.id, documentId),
            eq(schema.leadDocuments.tenantId, context.tenantId),
            eq(schema.leadDocuments.leadId, leadId)
          )
        )
        .returning({ filename: schema.leadDocuments.filename, requirementId: schema.leadDocuments.requirementId, beneficiaryId: schema.leadDocuments.beneficiaryId });

      if (!doc) throw new Error("Documento não encontrado.");
      reviewedFileName = doc.filename;

      if (doc.requirementId) {
        await tx.update(schema.leadDocumentChecklist).set({ documentId, status, updatedAt: new Date() }).where(and(
          eq(schema.leadDocumentChecklist.tenantId, context.tenantId),
          eq(schema.leadDocumentChecklist.leadId, leadId),
          eq(schema.leadDocumentChecklist.requirementId, doc.requirementId),
          doc.beneficiaryId ? eq(schema.leadDocumentChecklist.beneficiaryId, doc.beneficiaryId) : isNull(schema.leadDocumentChecklist.beneficiaryId),
        ));
      }

      await tx.insert(schema.leadInteractions).values({
        id: randomUUID(),
        leadId,
        userId: context.userId,
        tipo: "document_review",
        conteudo: `Documento "${reviewedFileName}" foi ${status === "approved" ? "aprovado" : "rejeitado"}.`,
        metadata: { documentId, status },
      });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_document", entidadeId: documentId, acao: `document.${status}` });
    });

    // Notify the broker responsible for the lead
    const [leadData] = await db
      .select({ corretorId: schema.leads.corretorId, nome: schema.leads.nome })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);

    if (leadData?.corretorId) {
      void publishNotification({
        capability: "document_reviewed",
        tenantId: context.tenantId,
        recipientUserId: leadData.corretorId,
        leadId,
        type: status === "approved" ? "document_approved" : "document_rejected",
        title: status === "approved" ? "Documento aprovado ✅" : "Documento rejeitado ❌",
        message: `O documento "${reviewedFileName}" do lead ${leadData.nome} foi ${status === "approved" ? "aprovado" : "rejeitado"}.`,
        pushTitle: status === "approved" ? "Documento Aprovado! ✅" : "Documento Rejeitado! ❌",
        pushBody: `${leadData.nome} — documento ${status === "approved" ? "aprovado" : "rejeitado"}.`,
        url: `/leads/${leadId}`,
        tag: `doc-${documentId}`,
      }).catch(() => { /* non-blocking */ });
    }

    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/documentos");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao avaliar documento." };
  }
}

export async function deleteDocumentAction(documentId: string): Promise<DocumentActionState> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  try {
    const [document] = await db
      .select({ id: schema.leadDocuments.id, leadId: schema.leadDocuments.leadId, filename: schema.leadDocuments.filename, requirementId: schema.leadDocuments.requirementId, beneficiaryId: schema.leadDocuments.beneficiaryId, corretorId: schema.leads.corretorId, branchId: schema.leads.branchId })
      .from(schema.leadDocuments)
      .innerJoin(schema.leads, eq(schema.leadDocuments.leadId, schema.leads.id))
      .where(and(eq(schema.leadDocuments.id, documentId), eq(schema.leadDocuments.tenantId, context.tenantId), isNull(schema.leadDocuments.deletedAt)))
      .limit(1);
    if (!document) return { error: "Documento não encontrado." };
    const allowed = context.role === "director" || (context.role === "manager" && context.branchId === document.branchId) || (context.role === "broker" && context.userId === document.corretorId);
    if (!allowed) return { error: "Você não pode excluir este documento." };

    await db.transaction(async (tx) => {
      await tx.update(schema.leadDocuments).set({ deletedAt: new Date(), deletedBy: context.userId }).where(and(eq(schema.leadDocuments.id, document.id), eq(schema.leadDocuments.tenantId, context.tenantId)));
      if (document.requirementId) {
        await tx.update(schema.leadDocumentChecklist).set({ documentId: null, status: "pending", updatedAt: new Date() }).where(and(
          eq(schema.leadDocumentChecklist.tenantId, context.tenantId),
          eq(schema.leadDocumentChecklist.leadId, document.leadId),
          eq(schema.leadDocumentChecklist.requirementId, document.requirementId),
          document.beneficiaryId ? eq(schema.leadDocumentChecklist.beneficiaryId, document.beneficiaryId) : isNull(schema.leadDocumentChecklist.beneficiaryId),
        ));
      }
      await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId: document.leadId, userId: context.userId, tipo: "document_upload", conteudo: `Documento "${document.filename}" removido.`, metadata: { documentId } });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_document", entidadeId: document.id, acao: "document.deleted" });
    });
    revalidatePath(`/leads/${document.leadId}`);
    revalidatePath("/documentos");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao remover documento." };
  }
}

// ─── Approval Queue & Bulk Actions ────────────────────────────────────────

export async function getPendingDocuments() {
  const context = await getRequiredTenantContext();

  const db = getDatabase();

  const query = db
    .select({
      id: schema.leadDocuments.id,
      filename: schema.leadDocuments.filename,
      fileUrl: schema.leadDocuments.fileUrl,
      status: schema.leadDocuments.status,
      createdAt: schema.leadDocuments.createdAt,
      leadId: schema.leadDocuments.leadId,
      leadNome: schema.leads.nome,
      corretorNome: schema.user.name,
      requirementName: schema.documentRequirements.name,
      branchId: schema.leads.branchId,
      branchName: schema.branches.name,
    })
    .from(schema.leadDocuments)
    .innerJoin(schema.leads, eq(schema.leadDocuments.leadId, schema.leads.id))
    .leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id))
    .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
    .leftJoin(schema.documentRequirements, eq(schema.leadDocuments.requirementId, schema.documentRequirements.id))
    .where(
      and(
        context.role === "broker"
          ? eq(schema.leads.corretorId, context.userId)
          : eq(schema.leadDocuments.status, "pending"),
        isNull(schema.leadDocuments.deletedAt),
        eq(schema.leadDocuments.tenantId, context.tenantId)
      )
    )
    .orderBy(schema.leadDocuments.createdAt);

  const rows = await query;

  // Filter based on branch scope for manager
  if (context.role === "manager" && context.branchId) {
    return rows.filter((r) => r.branchId === context.branchId);
  }

  return rows;
}

export async function bulkReviewDocumentsAction(
  documentIds: string[],
  status: "approved" | "rejected"
): Promise<DocumentActionState> {
  const context = await getRequiredTenantContext();
  if (context.role === "broker") return { error: "Acesso negado." };

  if (documentIds.length === 0) return { success: true };

  const db = getDatabase();
  try {
    await db.transaction(async (tx) => {
      // Find all target documents to verify context
      const docs = await tx
        .select({ id: schema.leadDocuments.id, leadId: schema.leadDocuments.leadId, filename: schema.leadDocuments.filename, requirementId: schema.leadDocuments.requirementId, beneficiaryId: schema.leadDocuments.beneficiaryId, branchId: schema.leads.branchId })
        .from(schema.leadDocuments)
        .innerJoin(schema.leads, eq(schema.leadDocuments.leadId, schema.leads.id))
        .where(
          and(
            inArray(schema.leadDocuments.id, documentIds),
            eq(schema.leadDocuments.tenantId, context.tenantId)
          )
        );

      // Filter by branch if manager
      const allowedDocs = context.role === "manager" && context.branchId
        ? docs.filter((doc) => doc.branchId === context.branchId)
        : docs;

      if (allowedDocs.length === 0) return;

      const allowedIds = allowedDocs.map((d) => d.id);

      await tx
        .update(schema.leadDocuments)
        .set({
          status,
          reviewedBy: context.userId,
          reviewedAt: new Date(),
        })
        .where(inArray(schema.leadDocuments.id, allowedIds));

      for (const doc of allowedDocs) {
        if (!doc.requirementId) continue;
        await tx.update(schema.leadDocumentChecklist).set({ documentId: doc.id, status, updatedAt: new Date() }).where(and(
          eq(schema.leadDocumentChecklist.tenantId, context.tenantId),
          eq(schema.leadDocumentChecklist.leadId, doc.leadId),
          eq(schema.leadDocumentChecklist.requirementId, doc.requirementId),
          doc.beneficiaryId ? eq(schema.leadDocumentChecklist.beneficiaryId, doc.beneficiaryId) : isNull(schema.leadDocumentChecklist.beneficiaryId),
        ));
      }

      // Audit logs and timeline interactions
      for (const doc of allowedDocs) {
        await tx.insert(schema.leadInteractions).values({
          id: randomUUID(),
          leadId: doc.leadId,
          userId: context.userId,
          tipo: "document_review",
          conteudo: `Documento "${doc.filename}" foi ${status === "approved" ? "aprovado" : "rejeitado"} em lote.`,
          metadata: { documentId: doc.id, status },
        });
      }
    });

    revalidatePath("/documentos");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao processar lote." };
  }
}

export async function getRequirementsForLead(leadId: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const [lead] = await db
    .select({
      planId: schema.leads.planId,
      carrierId: schema.carrierPlans.carrierId,
    })
    .from(schema.leads)
    .leftJoin(schema.carrierPlans, eq(schema.leads.planId, schema.carrierPlans.id))
    .where(and(
      eq(schema.leads.id, leadId),
      eq(schema.leads.tenantId, context.tenantId),
      context.role === "broker"
        ? eq(schema.leads.corretorId, context.userId)
        : context.role === "manager" && context.branchId
          ? eq(schema.leads.branchId, context.branchId)
          : undefined,
    ))
    .limit(1);

  if (!lead) return [];

  const allReqs = await db
    .select()
    .from(schema.documentRequirements)
    .where(eq(schema.documentRequirements.tenantId, context.tenantId));

  return allReqs.filter((req) => {
    if (req.planId) {
      return req.planId === lead.planId;
    }
    if (req.carrierId) {
      return req.carrierId === lead.carrierId;
    }
    return true;
  });
}

/**
 * Materializa, de forma idempotente, o checklist documental vigente do lead.
 * Cada requisito individual gera uma linha por beneficiário; requisitos
 * familiares geram uma única linha vinculada ao lead.
 */
export async function getLeadDocumentChecklist(leadId: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const requirements = await getRequirementsForLead(leadId);
  if (requirements.length === 0) return [];

  const beneficiaries = await db
    .select({ id: schema.leadBeneficiaries.id })
    .from(schema.leadBeneficiaries)
    .where(and(eq(schema.leadBeneficiaries.leadId, leadId), eq(schema.leadBeneficiaries.tenantId, context.tenantId)));

  const scopes = requirements.flatMap((requirement) => {
    const targets = requirement.appliesPerBeneficiary ? beneficiaries.map((beneficiary) => beneficiary.id) : [null];
    return targets.map((beneficiaryId) => ({
      id: randomUUID(),
      tenantId: context.tenantId,
      leadId,
      requirementId: requirement.id,
      beneficiaryId,
      scopeKey: `${context.tenantId}:${leadId}:${requirement.id}:${beneficiaryId ?? "lead"}`,
    }));
  });

  await db.transaction(async (tx) => {
    if (scopes.length > 0) {
      await tx.insert(schema.leadDocumentChecklist).values(scopes).onConflictDoNothing({ target: schema.leadDocumentChecklist.scopeKey });
    }

    const documents = await tx
      .select({
        id: schema.leadDocuments.id,
        requirementId: schema.leadDocuments.requirementId,
        beneficiaryId: schema.leadDocuments.beneficiaryId,
        status: schema.leadDocuments.status,
      })
      .from(schema.leadDocuments)
      .where(and(eq(schema.leadDocuments.tenantId, context.tenantId), eq(schema.leadDocuments.leadId, leadId), isNull(schema.leadDocuments.deletedAt)))
      .orderBy(schema.leadDocuments.createdAt);

    const latestByScope = new Map<string, (typeof documents)[number]>();
    for (const document of documents) {
      if (!document.requirementId) continue;
      latestByScope.set(`${document.requirementId}:${document.beneficiaryId ?? "lead"}`, document);
    }

    for (const scope of scopes) {
      const document = latestByScope.get(`${scope.requirementId}:${scope.beneficiaryId ?? "lead"}`);
      await tx.update(schema.leadDocumentChecklist).set({
        documentId: document?.id ?? null,
        status: document?.status ?? "pending",
        updatedAt: new Date(),
      }).where(and(eq(schema.leadDocumentChecklist.tenantId, context.tenantId), eq(schema.leadDocumentChecklist.scopeKey, scope.scopeKey)));
    }
  });

  return db
    .select({
      id: schema.leadDocumentChecklist.id,
      requirementId: schema.leadDocumentChecklist.requirementId,
      requirementName: schema.documentRequirements.name,
      required: schema.documentRequirements.required,
      appliesPerBeneficiary: schema.documentRequirements.appliesPerBeneficiary,
      beneficiaryId: schema.leadDocumentChecklist.beneficiaryId,
      beneficiaryName: schema.leadBeneficiaries.name,
      documentId: schema.leadDocumentChecklist.documentId,
      status: schema.leadDocumentChecklist.status,
    })
    .from(schema.leadDocumentChecklist)
    .innerJoin(schema.documentRequirements, eq(schema.leadDocumentChecklist.requirementId, schema.documentRequirements.id))
    .leftJoin(schema.leadBeneficiaries, eq(schema.leadDocumentChecklist.beneficiaryId, schema.leadBeneficiaries.id))
    .innerJoin(schema.leads, eq(schema.leadDocumentChecklist.leadId, schema.leads.id))
    .where(and(
      eq(schema.leadDocumentChecklist.tenantId, context.tenantId),
      eq(schema.leadDocumentChecklist.leadId, leadId),
      context.role === "broker" ? eq(schema.leads.corretorId, context.userId) : context.role === "manager" && context.branchId ? eq(schema.leads.branchId, context.branchId) : undefined,
    ));
}

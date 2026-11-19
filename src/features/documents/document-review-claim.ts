import { and, eq, inArray, isNull } from "drizzle-orm";

import type { DatabaseExecutor } from "@/shared/db";
import { schema } from "@/shared/db";

/** Claims pending documents in one conditional statement; only returned rows may trigger effects. */
export async function claimPendingDocumentsForReview(
  tx: DatabaseExecutor,
  input: {
    documentIds: string[];
    tenantId: string;
    leadId?: string;
    status: "approved" | "rejected";
    reviewerId: string;
    reviewComment?: string | null;
    now: Date;
  },
) {
  if (input.documentIds.length === 0) return [];
  return tx.update(schema.leadDocuments).set({
    status: input.status,
    reviewedBy: input.reviewerId,
    reviewedAt: input.now,
    ...(input.reviewComment !== undefined ? { reviewComment: input.reviewComment } : {}),
  }).where(and(
    inArray(schema.leadDocuments.id, input.documentIds),
    eq(schema.leadDocuments.tenantId, input.tenantId),
    input.leadId ? eq(schema.leadDocuments.leadId, input.leadId) : undefined,
    eq(schema.leadDocuments.status, "pending"),
    isNull(schema.leadDocuments.deletedAt),
  )).returning({
    id: schema.leadDocuments.id,
    leadId: schema.leadDocuments.leadId,
    filename: schema.leadDocuments.filename,
    requirementId: schema.leadDocuments.requirementId,
    beneficiaryId: schema.leadDocuments.beneficiaryId,
  });
}

import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { cleanQualificationOrder, DEFAULT_QUALIFICATION_ORDER, readQuestionTexts } from "./domain";

/** The tenant's qualification flow: the questions on, in order, and the director's texts. */
export async function getQualificationFlow(tenantId: string) {
  const [row] = await getDatabase()
    .select({ requiredFields: schema.aiQualificationConfigs.requiredFields, questionTexts: schema.aiQualificationConfigs.questionTexts, maxQuestions: schema.aiQualificationConfigs.maxQuestions })
    .from(schema.aiQualificationConfigs)
    .where(eq(schema.aiQualificationConfigs.tenantId, tenantId))
    .limit(1);
  const saved = Array.isArray(row?.requiredFields) ? cleanQualificationOrder(row.requiredFields) : [];
  return {
    enabledOrder: saved.length ? saved : DEFAULT_QUALIFICATION_ORDER,
    texts: readQuestionTexts(row?.questionTexts),
    configured: Boolean(row),
  };
}

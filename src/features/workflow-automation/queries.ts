import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";

function isMissingWorkflowTables(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as { code?: string; cause?: { code?: string } };
  return databaseError.code === "42P01" || databaseError.cause?.code === "42P01";
}

export async function getWorkflowAutomations(tenantId: string) {
  try {
    return await getDatabase().select().from(schema.workflowAutomations)
      .where(eq(schema.workflowAutomations.tenantId, tenantId))
      .orderBy(desc(schema.workflowAutomations.updatedAt));
  } catch (error) {
    if (isMissingWorkflowTables(error)) return [];
    throw error;
  }
}

export async function getWorkflowAutomation(workflowId: string, tenantId: string) {
  const [workflow] = await getDatabase().select().from(schema.workflowAutomations)
    .where(and(eq(schema.workflowAutomations.id, workflowId), eq(schema.workflowAutomations.tenantId, tenantId))).limit(1);
  return workflow ?? null;
}

export async function getWorkflowAutomationVersions(workflowId: string, tenantId: string) {
  return getDatabase().select().from(schema.workflowAutomationVersions)
    .where(and(eq(schema.workflowAutomationVersions.workflowId, workflowId), eq(schema.workflowAutomationVersions.tenantId, tenantId)))
    .orderBy(desc(schema.workflowAutomationVersions.version));
}

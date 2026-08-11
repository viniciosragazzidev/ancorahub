import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";

export async function getWorkflowAutomations(tenantId: string) {
  return getDatabase().select().from(schema.workflowAutomations)
    .where(eq(schema.workflowAutomations.tenantId, tenantId))
    .orderBy(desc(schema.workflowAutomations.updatedAt));
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

import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";

export type Actor = {
  userId: string;
  tenantId: string;
  role: "director" | "manager" | "broker";
  branchId: string | null;
};

export async function getAutomations(tenantId: string) {
  const db = getDatabase();
  return db
    .select()
    .from(schema.crmAutomations)
    .where(eq(schema.crmAutomations.tenantId, tenantId))
    .orderBy(desc(schema.crmAutomations.createdAt));
}

export async function getAutomationById(id: string, tenantId: string) {
  const db = getDatabase();
  const [row] = await db
    .select()
    .from(schema.crmAutomations)
    .where(and(eq(schema.crmAutomations.id, id), eq(schema.crmAutomations.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export async function getAutomationLogs(tenantId: string, limit = 50) {
  const db = getDatabase();
  return db
    .select()
    .from(schema.crmAutomationLogs)
    .where(eq(schema.crmAutomationLogs.tenantId, tenantId))
    .orderBy(desc(schema.crmAutomationLogs.createdAt))
    .limit(limit);
}

export async function getWhatsappFlows(tenantId: string) {
  const db = getDatabase();
  return db
    .select()
    .from(schema.whatsappFlows)
    .where(eq(schema.whatsappFlows.tenantId, tenantId))
    .orderBy(desc(schema.whatsappFlows.createdAt));
}

export async function getWhatsappFlowById(id: string, tenantId: string) {
  const db = getDatabase();
  const [row] = await db
    .select()
    .from(schema.whatsappFlows)
    .where(and(eq(schema.whatsappFlows.id, id), eq(schema.whatsappFlows.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export async function getExceptionInbox(tenantId: string) {
  const db = getDatabase();
  // Fetch logs that are in 'failed' or 'dead_letter' status.
  const failedLogs = await db
    .select()
    .from(schema.crmAutomationLogs)
    .where(
      and(
        eq(schema.crmAutomationLogs.tenantId, tenantId),
        eq(schema.crmAutomationLogs.status, "dead_letter")
      )
    )
    .orderBy(desc(schema.crmAutomationLogs.updatedAt));

  return {
    failedLogs,
  };
}

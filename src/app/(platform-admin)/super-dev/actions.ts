"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createPlatformTenant,
  TenantCnpjAlreadyExistsError,
  createTenantAccess,
  setPlatformTenantStatus,
  terminateSession,
  purgeUserLGPD,
  getPlatformAuditLogs,
  getTenantAuditLogs,
} from "@/features/platform-admin/service";

export type TenantCreateActionState = { error?: string };
import { getDatabase, schema } from "@/shared/db";
import { eq, and } from "drizzle-orm";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";

export async function createTenantAction(_: TenantCreateActionState, formData: FormData): Promise<TenantCreateActionState> {
  try {
    const tenantId = await createPlatformTenant(Object.fromEntries(formData));
    revalidatePath("/super-dev");
    revalidatePath("/super-dev/tenants");
    redirect(`/super-dev/tenants/${tenantId}`);
  } catch (error) {
    if (error instanceof TenantCnpjAlreadyExistsError) return { error: error.message };
    throw error;
  }
}

export async function setTenantStatusAction(formData: FormData) {
  const tenantId = String(formData.get("tenantId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "active" && status !== "inactive") throw new Error("Status inválido.");
  await setPlatformTenantStatus(tenantId, status);
  revalidatePath("/super-dev");
  revalidatePath("/super-dev/tenants");
  revalidatePath(`/super-dev/tenants/${tenantId}`);
}

export async function createTenantAccessAction(formData: FormData) {
  await createTenantAccess(Object.fromEntries(formData));
  const tenantId = String(formData.get("tenantId") ?? "");
  revalidatePath(`/super-dev/tenants/${tenantId}`);
}

export async function terminateSessionAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  await terminateSession(sessionId);
  revalidatePath("/super-dev/sessions");
}

export async function purgeUserLGPDAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  await purgeUserLGPD(userId);
  revalidatePath("/super-dev/audit");
}

export async function getLeadEvidenceReportAction(leadId: string) {
  await getRequiredPlatformAdmin();
  const db = getDatabase();

  const [lead] = await db.select({
    id: schema.leads.id,
    nome: schema.leads.nome,
    telefone: schema.leads.telefone,
    email: schema.leads.email,
    status: schema.leads.status,
    origem: schema.leads.origem,
    createdAt: schema.leads.createdAt,
  }).from(schema.leads).where(eq(schema.leads.id, leadId)).limit(1);

  if (!lead) return { error: "Lead não encontrado." };

  const timeline = await db.select({
    id: schema.leadInteractions.id,
    type: schema.leadInteractions.tipo,
    content: schema.leadInteractions.conteudo,
    createdAt: schema.leadInteractions.createdAt,
  }).from(schema.leadInteractions)
    .where(eq(schema.leadInteractions.leadId, leadId))
    .orderBy(schema.leadInteractions.createdAt);

  const documents = await db.select({
    id: schema.leadDocuments.id,
    fileName: schema.leadDocuments.filename,
    status: schema.leadDocuments.status,
    createdAt: schema.leadDocuments.createdAt,
  }).from(schema.leadDocuments)
    .where(eq(schema.leadDocuments.leadId, leadId))
    .orderBy(schema.leadDocuments.createdAt);

  return {
    success: true,
    report: {
      lead,
      timeline,
      documents,
      exportedAt: new Date().toISOString(),
    },
  };
}

export async function getPlatformAuditLogsAction() {
  return getPlatformAuditLogs();
}

export async function getTenantAuditLogsAction() {
  return getTenantAuditLogs();
}

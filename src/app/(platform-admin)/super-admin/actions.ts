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
import { eq } from "drizzle-orm";
import { runSlaSweep } from "@/features/leads/sla";
import { sql } from "drizzle-orm";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { setSystemSetting } from "@/features/system-settings/queries";
import { notificationCapabilities, notificationCapabilitySettingKey } from "@/features/notifications/catalog";
import { resetPlatformUserRouteOnboarding } from "@/features/onboarding/route-onboarding-service";
import { runLeadDistributionProcessor } from "@/features/lead-distribution/jobs";

function boundedDistributionSetting(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? String(parsed) : String(fallback);
}

export async function updateLeadDistributionJobsSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const db = getDatabase();
  const now = new Date();
  const values = {
    enabled: formData.get("enabled") === "true" ? "true" : "false",
    batchSize: boundedDistributionSetting(formData.get("batchSize"), 25, 1, 100),
    maxAttempts: boundedDistributionSetting(formData.get("maxAttempts"), 8, 1, 20),
    retryBaseSeconds: boundedDistributionSetting(formData.get("retryBaseSeconds"), 60, 15, 3600),
    leaseSeconds: boundedDistributionSetting(formData.get("leaseSeconds"), 120, 30, 900),
    recoveryMinutes: boundedDistributionSetting(formData.get("recoveryMinutes"), 5, 1, 60),
  };
  await Promise.all([
    setSystemSetting("feature_lead_distribution_jobs_enabled", values.enabled, now),
    setSystemSetting("lead_distribution_jobs_batch_size", values.batchSize, now),
    setSystemSetting("lead_distribution_jobs_max_attempts", values.maxAttempts, now),
    setSystemSetting("lead_distribution_jobs_retry_base_seconds", values.retryBaseSeconds, now),
    setSystemSetting("lead_distribution_jobs_lease_seconds", values.leaseSeconds, now),
    setSystemSetting("lead_distribution_jobs_recovery_minutes", values.recoveryMinutes, now),
  ]);
  await db.insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(), actorUserId: admin.userId, action: "lead_distribution_jobs.settings_updated",
    targetType: "system_settings", targetId: "lead_distribution_jobs", metadata: values, createdAt: now,
  });
  revalidatePath("/super-admin/settings");
  revalidatePath("/leads/distribuicao");
}

export async function runLeadDistributionJobsAction() {
  const admin = await getRequiredPlatformAdmin();
  const result = await runLeadDistributionProcessor();
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(), actorUserId: admin.userId, action: "lead_distribution_jobs.run_requested",
    targetType: "lead_distribution_jobs", targetId: "global", metadata: result, createdAt: new Date(),
  });
  revalidatePath("/super-admin/settings");
  revalidatePath("/leads/distribuicao");
}

export async function resetUserRouteOnboardingAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "").trim();
  const tenantId = String(formData.get("tenantId") ?? "").trim();
  if (!userId || !tenantId) throw new Error("Usuário e corretora são obrigatórios.");
  await resetPlatformUserRouteOnboarding(userId, tenantId);
  revalidatePath("/super-admin/onboarding");
}

export async function updateCentralAtencaoSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const db = getDatabase();
  const enabled = formData.get("centralAtencaoEnabled") === "true" ? "true" : "false";
  const stagnantDaysRaw = Number(formData.get("stagnantDays"));
  const stagnantDays = Number.isInteger(stagnantDaysRaw) && stagnantDaysRaw >= 1 && stagnantDaysRaw <= 30 ? String(stagnantDaysRaw) : "3";
  const now = new Date();

  for (const [key, value] of [
    ["feature_central_atencao_enabled", enabled],
    ["feature_central_atencao_stagnant_days", stagnantDays],
  ] as const) {
    await setSystemSetting(key, value, now);
  }

  await db.insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: admin.userId,
    action: "update_central_atencao_settings",
    targetType: "system_settings",
    targetId: "central_atencao",
    metadata: { enabled, stagnantDays },
    createdAt: now,
  });

  revalidatePath("/roadmap");
  revalidatePath("/super-admin/settings");
}

export async function updateGlobalSearchSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const db = getDatabase();
  const enabled = formData.get("globalSearchEnabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting("feature_global_search_enabled", enabled, now);
  await db.insert(schema.platformAuditLogs).values({ id: crypto.randomUUID(), actorUserId: admin.userId, action: "update_global_search_settings", targetType: "system_settings", targetId: "global_search", metadata: { enabled }, createdAt: now });
  revalidatePath("/super-admin/settings");
}

export async function updateInterfaceMotionSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("interfaceMotionEnabled") === "true" ? "true" : "false";
  const now = new Date();

  await setSystemSetting("feature_interface_motion_enabled", enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: admin.userId,
    action: "interface_motion_feature.updated",
    targetType: "system_settings",
    targetId: "interface_motion",
    metadata: { enabled },
    createdAt: now,
  });

  revalidatePath("/");
  revalidatePath("/super-admin/settings");
}

export async function updateMetaCloudWhatsAppSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("metaCloudWhatsAppEnabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting("feature_whatsapp_meta_cloud_enabled", enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(), actorUserId: admin.userId, action: "meta_cloud_whatsapp_feature.updated",
    targetType: "system_settings", targetId: "whatsapp_meta_cloud", metadata: { enabled }, createdAt: now,
  });
  revalidatePath("/super-admin/settings");
  revalidatePath("/settings/whatsapp");
}

export async function updateNotificationCapabilityAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const capabilityId = String(formData.get("capabilityId") ?? "");
  const capability = notificationCapabilities.find((item) => item.id === capabilityId);
  if (!capability) throw new Error("Capacidade de notificação inválida.");
  const enabled = formData.get("enabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting(notificationCapabilitySettingKey(capability.id), enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(), actorUserId: admin.userId, action: "notification_capability.updated",
    targetType: "notification_capability", targetId: capability.id, metadata: { enabled }, createdAt: now,
  });
  revalidatePath("/super-admin/settings");
}

export async function createTenantAction(_: TenantCreateActionState, formData: FormData): Promise<TenantCreateActionState> {
  try {
    const tenantId = await createPlatformTenant(Object.fromEntries(formData));
    revalidatePath("/super-admin");
    revalidatePath("/super-admin/tenants");
    redirect(`/super-admin/tenants/${tenantId}`);
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
  revalidatePath("/super-admin");
  revalidatePath("/super-admin/tenants");
  revalidatePath(`/super-admin/tenants/${tenantId}`);
}

export async function createTenantAccessAction(formData: FormData) {
  await createTenantAccess(Object.fromEntries(formData));
  const tenantId = String(formData.get("tenantId") ?? "");
  revalidatePath(`/super-admin/tenants/${tenantId}`);
}

export async function terminateSessionAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  await terminateSession(sessionId);
  revalidatePath("/super-admin/sessions");
}

export async function purgeUserLGPDAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  await purgeUserLGPD(userId);
  revalidatePath("/super-admin/audit");
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

// DEV TOOLS SERVER ACTIONS
export async function runDbQueryAction(tableName: string, limit: number = 20) {
  await getRequiredPlatformAdmin();
  const db = getDatabase();

  try {
    let result: unknown[] = [];
    switch (tableName) {
      case "tenants":
        result = await db.select().from(schema.tenants).limit(limit);
        break;
      case "user":
        result = await db.select().from(schema.user).limit(limit);
        break;
      case "leads":
        result = await db.select().from(schema.leads).limit(limit);
        break;
      case "auditLogs":
        result = await db.select().from(schema.auditLogs).limit(limit);
        break;
      case "platformAuditLogs":
        result = await db.select().from(schema.platformAuditLogs).limit(limit);
        break;
      case "session":
        result = await db.select().from(schema.session).limit(limit);
        break;
      case "leadInteractions":
        result = await db.select().from(schema.leadInteractions).limit(limit);
        break;
      case "leadDocuments":
        result = await db.select().from(schema.leadDocuments).limit(limit);
        break;
      default:
        throw new Error("Tabela desconhecida ou restrita.");
    }
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido ao executar query." };
  }
}

export async function triggerSlaCronAction() {
  await getRequiredPlatformAdmin();
  try {
    const result = await runSlaSweep();
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido no SLA cron." };
  }
}

export async function getSystemMetricsAction() {
  await getRequiredPlatformAdmin();
  const db = getDatabase();
  try {
    const dbSizeResult = await db.execute(sql`SELECT pg_size_pretty(pg_database_size(current_database())) as size`);
    const connectionsResult = await db.execute(sql`SELECT count(*) as active_connections FROM pg_stat_activity`);
    
    return {
      success: true,
      dbSize: String(dbSizeResult[0]?.size || "N/A"),
      activeConnections: Number(connectionsResult[0]?.active_connections || 0),
      env: process.env.NODE_ENV,
      authProvider: "BetterAuth (Local & Postgres Store)",
      databaseStatus: "Operacional (Conectado via Supabase)"
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao coletar métricas." };
  }
}

export async function updateAiSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const db = getDatabase();
  const now = new Date();

  const enabled = formData.get("aiEnabled") === "true" ? "true" : "false";
  const primaryProvider = String(formData.get("primaryProvider") ?? "groq").trim();
  const primaryModel = String(formData.get("primaryModel") ?? "").trim();
  const fallbackProvider = String(formData.get("fallbackProvider") ?? "none").trim();
  const fallbackModel = String(formData.get("fallbackModel") ?? "").trim();
  const temperature = String(formData.get("temperature") ?? "0.7").trim();
  const maxTokens = String(formData.get("maxTokens") ?? "1024").trim();
  const systemPrompt = String(formData.get("systemPrompt") ?? "").trim();
  const groqApiKey = String(formData.get("groqApiKey") ?? "").trim();
  const openaiApiKey = String(formData.get("openaiApiKey") ?? "").trim();
  const googleApiKey = String(formData.get("googleApiKey") ?? "").trim();
  const openrouterApiKey = String(formData.get("openrouterApiKey") ?? "").trim();

  await setSystemSetting("ai_enabled", enabled, now);
  await setSystemSetting("ai_primary_provider", primaryProvider, now);
  await setSystemSetting("ai_primary_model", primaryModel, now);
  await setSystemSetting("ai_fallback_provider", fallbackProvider, now);
  await setSystemSetting("ai_fallback_model", fallbackModel, now);
  await setSystemSetting("ai_temperature", temperature, now);
  await setSystemSetting("ai_max_tokens", maxTokens, now);
  await setSystemSetting("ai_system_prompt", systemPrompt, now);

  if (groqApiKey) await setSystemSetting("ai_groq_api_key", groqApiKey, now);
  if (openaiApiKey) await setSystemSetting("ai_openai_api_key", openaiApiKey, now);
  if (googleApiKey) await setSystemSetting("ai_google_api_key", googleApiKey, now);
  if (openrouterApiKey) await setSystemSetting("ai_openrouter_api_key", openrouterApiKey, now);

  await db.insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: admin.userId,
    action: "update_ai_settings",
    targetType: "system_settings",
    targetId: "ai_engine",
    metadata: { enabled, primaryProvider, primaryModel, fallbackProvider },
    createdAt: now,
  });

  revalidatePath("/super-admin/settings");
}

export async function updateAiWhatsAppQualificationSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("aiWhatsAppQualificationEnabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting("feature_ai_whatsapp_qualification_enabled", enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(), actorUserId: admin.userId, action: "update_ai_whatsapp_qualification_settings",
    targetType: "system_settings", targetId: "ai_whatsapp_qualification", metadata: { enabled }, createdAt: now,
  });
  revalidatePath("/super-admin/settings");
}

export async function updateLeadManagementActionsSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const db = getDatabase();
  const enabled = formData.get("leadManagementActionsEnabled") === "true" ? "true" : "false";
  const now = new Date();

  await setSystemSetting("feature_lead_management_actions_enabled", enabled, now);

  await db.insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: admin.userId,
    action: "update_lead_management_actions_settings",
    targetType: "system_settings",
    targetId: "lead_management_actions",
    metadata: { enabled },
    createdAt: now,
  });

  revalidatePath("/super-admin/settings");
  revalidatePath("/leads");
}


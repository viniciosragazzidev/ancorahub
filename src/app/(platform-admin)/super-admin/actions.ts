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
  purgeTenantOperationalData,
  getPlatformAuditLogs,
  getTenantAuditLogs,
} from "@/features/platform-admin/service";

export type TenantCreateActionState = { error?: string };
import { getDatabase, schema } from "@/shared/db";
import { eq } from "drizzle-orm";
import { runSlaSweep } from "@/features/leads/sla";
import { sql } from "drizzle-orm";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getSystemSetting, setSystemSetting } from "@/features/system-settings/queries";
import { z } from "zod";
import { provisionDefaultMarketingRole } from "@/features/custom-roles/service";
import { notificationCapabilities, notificationCapabilitySettingKey } from "@/features/notifications/catalog";
import { resetPlatformUserRouteOnboarding } from "@/features/onboarding/route-onboarding-service";
import { runLeadDistributionProcessor } from "@/features/lead-distribution/jobs";
import { runLeadEffectOutboxProcessor } from "@/features/leads/webhooks/services/lead-effect-outbox";
import { META_LEAD_ADS_PLATFORM_SETTINGS } from "@/features/communication-channels/meta-lead-ads-platform";
import { CLEAN_UI_FEATURE, CLEAN_UI_LEGACY_TENANTS_SETTING } from "@/features/clean-ui/feature";
import { REALTIME_SYNC_FEATURE } from "@/features/notifications/realtime-sync";

async function requirePlatformTenantTarget(tenantId: string) {
  const parsedTenantId = z.string().uuid().safeParse(tenantId);
  if (!parsedTenantId.success) throw new Error("Empresa inválida.");

  const [tenant] = await getDatabase()
    .select({ id: schema.tenants.id })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, parsedTenantId.data))
    .limit(1);

  if (!tenant) throw new Error("Empresa não encontrada.");
  return tenant.id;
}

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

export async function updateBrokerWorkspaceSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("brokerWorkspaceEnabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting("feature_broker_workspace_enabled", enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: admin.userId,
    action: "broker_workspace.global_feature_updated",
    targetType: "system_settings",
    targetId: "broker_workspace",
    metadata: { enabled },
    createdAt: now,
  });
  revalidatePath("/dashboard");
  revalidatePath("/super-admin/settings");
}

export async function updateWorkflowAutomationSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("workflowAutomationEnabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting("feature_workflow_automation_enabled", enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: admin.userId,
    action: "workflow_automation.global_feature_updated",
    targetType: "system_settings",
    targetId: "workflow_automation",
    metadata: { enabled },
    createdAt: now,
  });
  revalidatePath("/automacoes");
  revalidatePath("/super-admin/settings");
}

export async function updateCleanUiOperationalSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("cleanUiOperationalEnabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting(CLEAN_UI_FEATURE, enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(), actorUserId: admin.userId, action: "clean_ui_operational.global_feature_updated",
    targetType: "system_settings", targetId: "clean_ui_operational", metadata: { enabled }, createdAt: now,
  });
  revalidatePath("/dashboard");
  revalidatePath("/super-admin/settings");
}

export async function updateCleanUiOperationalLegacyTenantAction(tenantId: string, formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const input = z.object({ enabled: z.enum(["true", "false"]) }).parse({ enabled: formData.get("enabled") });
  const targetTenantId = await requirePlatformTenantTarget(tenantId);
  const now = new Date();
  const current = await getSystemSetting(CLEAN_UI_LEGACY_TENANTS_SETTING);
  let tenantIds: string[] = [];
  try {
    const parsed: unknown = JSON.parse(current ?? "[]");
    if (Array.isArray(parsed)) tenantIds = parsed.filter((value): value is string => typeof value === "string");
  } catch { /* start from a safe empty exception list */ }
  const updated = input.enabled === "true" ? [...new Set([...tenantIds, targetTenantId])] : tenantIds.filter((storedTenantId) => storedTenantId !== targetTenantId);
  await setSystemSetting(CLEAN_UI_LEGACY_TENANTS_SETTING, JSON.stringify(updated), now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(), actorUserId: admin.userId, action: "clean_ui_operational.tenant_fallback_updated",
    targetType: "tenant", targetId: targetTenantId, metadata: { usingLegacyLayout: input.enabled === "true" }, createdAt: now,
  });
  revalidatePath("/dashboard");
  revalidatePath("/super-admin/settings");
  revalidatePath(`/super-admin/tenants/${targetTenantId}`);
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

export async function updateR2StorageSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("r2StorageEnabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting("feature_r2_storage_enabled", enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(), actorUserId: admin.userId, action: "r2_storage_feature.updated",
    targetType: "system_settings", targetId: "r2_storage", metadata: { enabled }, createdAt: now,
  });
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
  revalidatePath("/integrations/whatsapp");
}

export async function updateMetaLeadAdsSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("metaLeadAdsEnabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting("feature_meta_lead_ads_enabled", enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(), actorUserId: admin.userId, action: "meta_lead_ads_feature.updated",
    targetType: "system_settings", targetId: "meta_lead_ads", metadata: { enabled }, createdAt: now,
  });
  revalidatePath("/super-admin/settings");
  revalidatePath("/integrations/meta");
}

export async function updateMetaLeadAdsPlatformIdentityAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const input = z.object({ partnerName: z.string().trim().min(2).max(80), businessId: z.string().trim().regex(/^\d{5,40}$/), supportWhatsApp: z.string().trim().min(8).max(32) }).parse({ partnerName: formData.get("partnerName"), businessId: formData.get("businessId"), supportWhatsApp: formData.get("supportWhatsApp") });
  const now = new Date();
  await Promise.all([
    setSystemSetting(META_LEAD_ADS_PLATFORM_SETTINGS.partnerName, input.partnerName, now),
    setSystemSetting(META_LEAD_ADS_PLATFORM_SETTINGS.businessId, input.businessId, now),
    setSystemSetting(META_LEAD_ADS_PLATFORM_SETTINGS.supportWhatsApp, input.supportWhatsApp, now),
  ]);
  await getDatabase().insert(schema.platformAuditLogs).values({ id: crypto.randomUUID(), actorUserId: admin.userId, action: "meta_lead_ads.platform_identity_updated", targetType: "system_settings", targetId: "meta_lead_ads_identity", metadata: input, createdAt: now });
  revalidatePath("/super-admin/settings"); revalidatePath("/integrations/meta");
}

export async function updateMetaLeadAdsPilotAction(tenantId: string, formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const input = z.object({ enabled: z.enum(["true", "false"]) }).parse({ enabled: formData.get("enabled") });
  const targetTenantId = await requirePlatformTenantTarget(tenantId);
  const key = META_LEAD_ADS_PLATFORM_SETTINGS.pilotTenantIds;
  const current = await getSystemSetting(key);
  let ids: string[] = [];
  try { const parsed: unknown = JSON.parse(current ?? "[]"); if (Array.isArray(parsed)) ids = parsed.filter((value): value is string => typeof value === "string"); } catch { /* recover to a safe empty pilot */ }
  const next = input.enabled === "true" ? [...new Set([...ids, targetTenantId])] : ids.filter((id) => id !== targetTenantId);
  const now = new Date();
  await setSystemSetting(key, JSON.stringify(next), now);
  await getDatabase().insert(schema.platformAuditLogs).values({ id: crypto.randomUUID(), actorUserId: admin.userId, action: "meta_lead_ads.tenant_pilot_updated", targetType: "tenant", targetId: targetTenantId, metadata: { enabled: input.enabled === "true" }, createdAt: now });
  revalidatePath("/super-admin/settings"); revalidatePath("/integrations/meta");
  revalidatePath(`/super-admin/tenants/${targetTenantId}`);
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

export async function updateLeadEffectOutboxSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const now = new Date();
  const values = {
    enabled: formData.get("enabled") === "true" ? "true" : "false",
    maxAttempts: boundedDistributionSetting(formData.get("maxAttempts"), 8, 1, 20),
    retryBaseSeconds: boundedDistributionSetting(formData.get("retryBaseSeconds"), 60, 15, 3600),
    leaseSeconds: boundedDistributionSetting(formData.get("leaseSeconds"), 120, 30, 900),
  };
  await Promise.all([
    setSystemSetting("feature_lead_intake_outbox_enabled", values.enabled, now),
    setSystemSetting("lead_intake_outbox_max_attempts", values.maxAttempts, now),
    setSystemSetting("lead_intake_outbox_retry_base_seconds", values.retryBaseSeconds, now),
    setSystemSetting("lead_intake_outbox_lease_seconds", values.leaseSeconds, now),
  ]);
  await getDatabase().insert(schema.platformAuditLogs).values({ id: crypto.randomUUID(), actorUserId: admin.userId, action: "lead_effect_outbox.settings_updated", targetType: "system_settings", targetId: "lead_effect_outbox", metadata: values, createdAt: now });
  revalidatePath("/super-admin/settings");
}

export async function runLeadEffectOutboxAction() {
  const admin = await getRequiredPlatformAdmin();
  const result = await runLeadEffectOutboxProcessor();
  await getDatabase().insert(schema.platformAuditLogs).values({ id: crypto.randomUUID(), actorUserId: admin.userId, action: "lead_effect_outbox.run_requested", targetType: "lead_effect_outbox", targetId: "global", metadata: result, createdAt: new Date() });
  revalidatePath("/super-admin/settings");
  revalidatePath("/leads/distribuicao");
}

export async function updateWahaCadenceSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const now = new Date();
  const values = {
    enabled: formData.get("enabled") === "true" ? "true" : "false",
    aiEnabled: formData.get("aiEnabled") === "true" ? "true" : "false",
    maxAttempts: boundedDistributionSetting(formData.get("maxAttempts"), 5, 1, 10),
    retryBaseSeconds: boundedDistributionSetting(formData.get("retryBaseSeconds"), 60, 15, 3600),
    leaseSeconds: boundedDistributionSetting(formData.get("leaseSeconds"), 120, 30, 900),
  };
  await Promise.all([
    setSystemSetting("feature_waha_cadence_enabled", values.enabled, now),
    setSystemSetting("feature_waha_ai_enabled", values.aiEnabled, now),
    setSystemSetting("waha_cadence_max_attempts", values.maxAttempts, now),
    setSystemSetting("waha_cadence_retry_base_seconds", values.retryBaseSeconds, now),
    setSystemSetting("waha_cadence_lease_seconds", values.leaseSeconds, now),
  ]);
  await getDatabase().insert(schema.platformAuditLogs).values({ id: crypto.randomUUID(), actorUserId: admin.userId, action: "waha_cadence.settings_updated", targetType: "system_settings", targetId: "waha_cadence", metadata: values, createdAt: now });
  revalidatePath("/super-admin/settings");
}

export async function updateWahaConnectionSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("connectionsEnabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting("feature_waha_connections_enabled", enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({ id: crypto.randomUUID(), actorUserId: admin.userId, action: "waha_connections.settings_updated", targetType: "system_settings", targetId: "waha_connections", metadata: { enabled }, createdAt: now });
  revalidatePath("/super-admin/settings");
  revalidatePath("/integrations/whatsapp");
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

export async function updateQuickReplySettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("quickReplyEnabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting("feature_ai_quick_reply_enabled", enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(), actorUserId: admin.userId, action: "update_ai_quick_reply_settings",
    targetType: "system_settings", targetId: "ai_quick_reply", metadata: { enabled }, createdAt: now,
  });
  revalidatePath("/super-admin/settings");
}

const AI_MEMORY_RESET_MODES = ["never", "before_each_message", "before_each_session", "manual"] as const;

export async function updateAiMemoryResetSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const mode = String(formData.get("aiMemoryResetMode") ?? "before_each_session").trim();
  if (!(AI_MEMORY_RESET_MODES as readonly string[]).includes(mode)) {
    throw new Error("Modo de reset de memória inválido.");
  }
  const now = new Date();
  await setSystemSetting("ai_memory_reset_mode", mode, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: admin.userId,
    action: "update_ai_memory_reset_settings",
    targetType: "system_settings",
    targetId: "ai_memory_reset_mode",
    metadata: { mode },
    createdAt: now,
  });
  revalidatePath("/super-admin/settings");
}

export async function updateAgentTrainingCenterSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("agentTrainingCenterEnabled") === "true" ? "true" : "false";
  const now = new Date();

  await setSystemSetting("feature_agent_training_center_enabled", enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: admin.userId,
    action: "agent_training_center.global_feature_updated",
    targetType: "system_settings",
    targetId: "agent_training_center",
    metadata: { enabled },
    createdAt: now,
  });

  revalidatePath("/super-admin/settings");
  revalidatePath("/settings");
}

export async function updatePerformanceRankingSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("performanceRankingEnabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting("feature_performance_ranking_enabled", enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: admin.userId,
    action: "performance_ranking.global_feature_updated",
    targetType: "system_settings",
    targetId: "performance_ranking",
    metadata: { enabled },
    createdAt: now,
  });
  revalidatePath("/super-admin/settings");
  revalidatePath("/metas/desempenho");
}

export async function updateTeamMemberProfileSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("teamMemberProfileEnabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting("feature_team_member_profile_enabled", enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: admin.userId,
    action: "team_member_profile.global_feature_updated",
    targetType: "system_settings",
    targetId: "team_member_profile",
    metadata: { enabled },
    createdAt: now,
  });
  revalidatePath("/super-admin/settings");
  revalidatePath("/equipe");
}

export async function updateUserProfileSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("userProfileEnabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting("feature_user_profile_enabled", enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: admin.userId,
    action: "user_profile.global_feature_updated",
    targetType: "system_settings",
    targetId: "user_profile",
    metadata: { enabled },
    createdAt: now,
  });
  revalidatePath("/super-admin/settings");
  revalidatePath("/settings");
}

export async function updateCustomRolesGlobalSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("enabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting("feature_custom_roles_enabled", enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({ id: crypto.randomUUID(), actorUserId: admin.userId, action: "custom_roles.global_feature_updated", targetType: "system_settings", targetId: "custom_roles", metadata: { enabled }, createdAt: now });
  revalidatePath("/super-admin/settings");
  revalidatePath("/equipe/cargos");
}

export async function updateTenantCustomRolesPilotAction(tenantId: string, formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const input = z.object({ enabled: z.enum(["true", "false"]) }).parse({ enabled: formData.get("enabled") });
  const targetTenantId = await requirePlatformTenantTarget(tenantId);
  const now = new Date();
  if (input.enabled === "true") await provisionDefaultMarketingRole({ tenantId: targetTenantId, actorUserId: admin.userId });
  await getDatabase().insert(schema.tenantCustomRoleSettings).values({ tenantId: targetTenantId, enabled: input.enabled === "true", updatedBy: admin.userId, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: schema.tenantCustomRoleSettings.tenantId, set: { enabled: input.enabled === "true", updatedBy: admin.userId, updatedAt: now } });
  await getDatabase().insert(schema.platformAuditLogs).values({ id: crypto.randomUUID(), actorUserId: admin.userId, action: "custom_roles.tenant_pilot_updated", targetType: "tenant", targetId: targetTenantId, metadata: { enabled: input.enabled }, createdAt: now });
  revalidatePath("/super-admin/settings");
  revalidatePath("/equipe/cargos");
  revalidatePath(`/super-admin/tenants/${targetTenantId}`);
}

export async function updateRealtimeSyncSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("realtimeSyncEnabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting(REALTIME_SYNC_FEATURE, enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: admin.userId,
    action: "notification_realtime_sync.updated",
    targetType: "system_settings",
    targetId: REALTIME_SYNC_FEATURE,
    metadata: { enabled },
    createdAt: now,
  });
  revalidatePath("/super-admin/settings");
}

export async function updateExtensionGlobalSettingsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("extensionEnabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting("feature_browser_extension_enabled", enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({ id: crypto.randomUUID(), actorUserId: admin.userId, action: "update_browser_extension_global_settings", targetType: "system_settings", targetId: "browser_extension", metadata: { enabled }, createdAt: now });
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

export async function updateMetaShowPausedCampaignsWithActiveLeadsAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const enabled = formData.get("metaShowPausedCampaignsWithActiveLeadsEnabled") === "true" ? "true" : "false";
  const now = new Date();
  await setSystemSetting("feature_meta_show_paused_campaigns_with_active_leads_enabled", enabled, now);
  await getDatabase().insert(schema.platformAuditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: admin.userId,
    action: "meta_show_paused_campaigns_with_active_leads_feature.updated",
    targetType: "system_settings",
    targetId: "meta_show_paused_campaigns_with_active_leads",
    metadata: { enabled },
    createdAt: now,
  });
  revalidatePath("/super-admin/settings");
  revalidatePath("/marketing/campanhas");
}

export async function resetTenantOperationalDataAction(formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const rawTenantId = String(formData.get("tenantId") ?? "").trim();
  const confirmation = String(formData.get("confirmation") ?? "").trim();

  const parsed = z.string().uuid().safeParse(rawTenantId);
  if (!parsed.success) {
    throw new Error("ID da empresa é inválido.");
  }

  if (confirmation !== "RESET") {
    throw new Error('Confirmação inválida. Digite "RESET" para confirmar a operação.');
  }

  const result = await purgeTenantOperationalData(parsed.data);

  revalidatePath(`/super-admin/tenants/${parsed.data}`);
  revalidatePath("/super-admin/tenants");
  revalidatePath("/leads");
  revalidatePath("/conversas");
  revalidatePath("/dashboard");

  return result;
}


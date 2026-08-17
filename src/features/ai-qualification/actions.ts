"use server";

import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AuthorizationError } from "@/shared/auth/errors";
import {
  getQualificationTenantSettings,
  updateQualificationTenantSettings,
  type UpdateTenantSettingsInput,
} from "./tenant-settings-service";
import {
  addTestNumber,
  getTenantTestNumbers,
  removeTestNumber,
  type AddTestNumberInput,
} from "./test-numbers-service";
import {
  resetQualificationSessionMemory,
  type ResetMemoryInput,
} from "./memory-reset-service";
import {
  sendWhatsAppTestMessage,
  type SendWhatsAppTestMessageInput,
} from "./whatsapp-diagnostic-service";
import {
  getFollowUpRules,
  saveFollowUpRule,
  deleteFollowUpRule,
  type FollowUpRuleInput,
} from "./followup-service";
import {
  getToolPermissions,
  updateToolPermission,
  type UpdateToolPermissionInput,
} from "./tool-governance-service";
import {
  getDestinationRules,
  saveDestinationRule,
  getBrokerEligibilityProfiles,
  saveBrokerEligibilityProfile,
  type DestinationRuleInput,
  type BrokerEligibilityInput,
} from "./destination-routing-service";
import { getQualificationStats } from "./stats-service";
import { acknowledgeAlert } from "./alerts-service";

function assertAdminRole(role: string | null | undefined) {
  if (role !== "director" && role !== "manager") {
    throw new AuthorizationError("Apenas diretores e gestores podem acessar a qualificação.");
  }
}

export async function fetchQualificationSettingsAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  return getQualificationTenantSettings(context.tenantId);
}

export async function updateQualificationSettingsAction(input: UpdateTenantSettingsInput) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await updateQualificationTenantSettings(context.tenantId, context.userId, input);
  revalidatePath("/qualificacao");
  return result;
}

export async function fetchTestNumbersAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  return getTenantTestNumbers(context.tenantId);
}

export async function addTestNumberAction(input: AddTestNumberInput) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await addTestNumber(context.tenantId, context.userId, input);
  revalidatePath("/qualificacao");
  return result;
}

export async function removeTestNumberAction(id: string) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await removeTestNumber(context.tenantId, context.userId, id);
  revalidatePath("/qualificacao");
  return result;
}

export async function resetMemoryAction(input: ResetMemoryInput) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await resetQualificationSessionMemory(context.tenantId, context.userId, input);
  revalidatePath("/qualificacao");
  return result;
}

export async function sendWhatsAppTestMessageAction(input: SendWhatsAppTestMessageInput) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await sendWhatsAppTestMessage(context.tenantId, context.userId, input);
  revalidatePath("/qualificacao");
  return result;
}

export async function fetchFollowUpRulesAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  return getFollowUpRules(context.tenantId);
}

export async function saveFollowUpRuleAction(input: FollowUpRuleInput) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await saveFollowUpRule(context.tenantId, context.userId, input);
  revalidatePath("/qualificacao");
  return result;
}

export async function deleteFollowUpRuleAction(ruleId: string) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await deleteFollowUpRule(context.tenantId, context.userId, ruleId);
  revalidatePath("/qualificacao");
  return result;
}

export async function fetchToolPermissionsAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  return getToolPermissions(context.tenantId);
}

export async function updateToolPermissionAction(input: UpdateToolPermissionInput) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await updateToolPermission(context.tenantId, context.userId, input);
  revalidatePath("/qualificacao");
  return result;
}

export async function fetchDestinationRulesAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  return getDestinationRules(context.tenantId);
}

export async function saveDestinationRuleAction(input: DestinationRuleInput) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await saveDestinationRule(context.tenantId, context.userId, input);
  revalidatePath("/qualificacao");
  return result;
}

export async function fetchBrokerEligibilityProfilesAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  return getBrokerEligibilityProfiles(context.tenantId);
}

export async function saveBrokerEligibilityProfileAction(input: BrokerEligibilityInput) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await saveBrokerEligibilityProfile(context.tenantId, context.userId, input);
  revalidatePath("/qualificacao");
  return result;
}

export async function fetchQualificationStatsAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  return getQualificationStats(context.tenantId);
}

export async function acknowledgeAlertAction(alertId: string) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const result = await acknowledgeAlert(context.tenantId, context.userId, alertId);
  revalidatePath("/qualificacao");
  return result;
}

export async function fetchMetaTemplatesAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const { listTenantTemplates, syncTenantTemplates } = await import("@/features/communication-channels/template-sync-service");
  const { getDatabase, schema } = await import("@/shared/db");
  const { and, eq, isNull } = await import("drizzle-orm");

  const db = getDatabase();

  // Purge synthetic placeholder templates with wabaId = "waba_default"
  await db
    .delete(schema.metaWhatsAppTemplates)
    .where(
      and(
        eq(schema.metaWhatsAppTemplates.tenantId, context.tenantId),
        eq(schema.metaWhatsAppTemplates.wabaId, "waba_default")
      )
    )
    .catch(() => undefined);

  // Automatically sync real templates from Meta Graph API
  await syncTenantTemplates(context.tenantId).catch((err) => {
    console.warn("[fetchMetaTemplatesAction] auto-sync error:", err);
  });

  // Fetch active default usage
  const [defaultUsage] = await db
    .select({ templateId: schema.metaWhatsAppTemplateUsages.templateId })
    .from(schema.metaWhatsAppTemplateUsages)
    .where(
      and(
        eq(schema.metaWhatsAppTemplateUsages.tenantId, context.tenantId),
        eq(schema.metaWhatsAppTemplateUsages.eventKey, "FIRST_CONTACT"),
        eq(schema.metaWhatsAppTemplateUsages.active, true)
      )
    )
    .limit(1);

  const templates = await listTenantTemplates(context.tenantId);

  return templates.map((t) => ({
    ...t,
    isDefault: defaultUsage ? t.id === defaultUsage.templateId : t.name === "lead_first_contact",
  }));
}

export async function setDefaultMetaTemplateAction(templateId: string) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const { getDatabase, schema } = await import("@/shared/db");
  const { and, eq } = await import("drizzle-orm");
  const { randomUUID } = await import("node:crypto");

  const db = getDatabase();

  // Deactivate existing FIRST_CONTACT usages
  await db
    .update(schema.metaWhatsAppTemplateUsages)
    .set({ active: false, updatedAt: new Date() })
    .where(
      and(
        eq(schema.metaWhatsAppTemplateUsages.tenantId, context.tenantId),
        eq(schema.metaWhatsAppTemplateUsages.eventKey, "FIRST_CONTACT")
      )
    );

  // Insert or activate usage
  const [existingUsage] = await db
    .select({ id: schema.metaWhatsAppTemplateUsages.id })
    .from(schema.metaWhatsAppTemplateUsages)
    .where(
      and(
        eq(schema.metaWhatsAppTemplateUsages.tenantId, context.tenantId),
        eq(schema.metaWhatsAppTemplateUsages.eventKey, "FIRST_CONTACT"),
        eq(schema.metaWhatsAppTemplateUsages.templateId, templateId)
      )
    )
    .limit(1);

  if (existingUsage) {
    await db
      .update(schema.metaWhatsAppTemplateUsages)
      .set({ active: true, updatedAt: new Date() })
      .where(eq(schema.metaWhatsAppTemplateUsages.id, existingUsage.id));
  } else {
    await db.insert(schema.metaWhatsAppTemplateUsages).values({
      id: `usage_${randomUUID()}`,
      tenantId: context.tenantId,
      eventKey: "FIRST_CONTACT",
      templateId,
      active: true,
      variableMappingsJson: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  revalidatePath("/qualificacao");
  return { success: true };
}

export async function deleteMetaTemplateAction(templateId: string) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const { getDatabase, schema } = await import("@/shared/db");
  const { and, eq } = await import("drizzle-orm");

  const db = getDatabase();
  await db
    .update(schema.metaWhatsAppTemplates)
    .set({ deletedAt: new Date(), status: "DELETED", updatedAt: new Date() })
    .where(
      and(
        eq(schema.metaWhatsAppTemplates.tenantId, context.tenantId),
        eq(schema.metaWhatsAppTemplates.id, templateId)
      )
    );

  revalidatePath("/qualificacao");
  return { success: true };
}

export async function syncMetaTemplatesAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  const { syncTenantTemplates } = await import("@/features/communication-channels/template-sync-service");
  await syncTenantTemplates(context.tenantId).catch(() => undefined);
  revalidatePath("/qualificacao");
  return { success: true };
}

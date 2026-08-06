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

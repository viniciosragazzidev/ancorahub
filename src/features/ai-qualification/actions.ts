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

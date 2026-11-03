"use server";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireRole, requireAnyRole } from "@/shared/auth/authorization";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import type { ExtensionCodeBinding } from "./schemas";
import { createExtensionAuthorizationCode } from "./auth";
import { isExtensionPilotUser } from "./pilot";

export async function createExtensionCodeAction(binding?: ExtensionCodeBinding) {
  const context = requireAnyRole(await getRequiredTenantContext(), ["broker", "manager", "director"]);
  if (!await isExtensionPilotUser(context.userId)) throw new AuthorizationError("Extensão desativada.");
  const db = getDatabase();
  await db.insert(schema.extensionSettings).values({ id: crypto.randomUUID(), tenantId: context.tenantId, updatedBy: context.userId }).onConflictDoNothing({ target: schema.extensionSettings.tenantId });
  return { code: await createExtensionAuthorizationCode(binding), expiresInSeconds: 300 };
}

export async function updateExtensionSettingsAction(formData: FormData) {
  const context = requireRole(await getRequiredTenantContext(), "director");
  const enabled = formData.get("enabled") === "true";
  await getDatabase().insert(schema.extensionSettings).values({ id: crypto.randomUUID(), tenantId: context.tenantId, enabled, updatedBy: context.userId }).onConflictDoUpdate({ target: schema.extensionSettings.tenantId, set: { enabled, updatedBy: context.userId, updatedAt: new Date() } });
}

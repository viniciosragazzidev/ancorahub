"use server";

import { and, eq } from "drizzle-orm";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireRole, requireAnyRole } from "@/shared/auth/authorization";
import { getDatabase, schema } from "@/shared/db";
import { createExtensionAuthorizationCode } from "./auth";

export async function createExtensionCodeAction() {
  const context = requireAnyRole(await getRequiredTenantContext(), ["broker", "manager", "director"]);
  const db = getDatabase();
  await db.insert(schema.extensionSettings).values({ id: crypto.randomUUID(), tenantId: context.tenantId, updatedBy: context.userId }).onConflictDoNothing({ target: schema.extensionSettings.tenantId });
  return { code: await createExtensionAuthorizationCode(), expiresInSeconds: 300 };
}

export async function updateExtensionSettingsAction(formData: FormData) {
  const context = requireRole(await getRequiredTenantContext(), "director");
  const enabled = formData.get("enabled") === "true";
  await getDatabase().insert(schema.extensionSettings).values({ id: crypto.randomUUID(), tenantId: context.tenantId, enabled, updatedBy: context.userId }).onConflictDoUpdate({ target: schema.extensionSettings.tenantId, set: { enabled, updatedBy: context.userId, updatedAt: new Date() } });
}

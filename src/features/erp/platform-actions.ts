"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { invalidateSystemSettingsCache } from "@/features/system-settings/queries";
import { ERP_IMPLEMENTED_MODULES, ErpError, erpModuleKeySchema, type ErpActionResult } from "./contracts";
import { erpAction } from "./action-result";
import { assertErpSchemaReady } from "./preflight";

export async function updateErpPlatformAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => {
    const admin = await getRequiredPlatformAdmin();
    const modules = z.array(erpModuleKeySchema).max(7).parse(form.getAll("modules"));
    const enabled = form.get("enabled") === "on";
    if (modules.some((module) => !ERP_IMPLEMENTED_MODULES.has(module))) throw new ErpError("Um dos módulos selecionados ainda está em preparação.");
    await getDatabase().transaction(async (tx) => {
      if (enabled) await assertErpSchemaReady(tx);
      await tx.insert(schema.systemSettings).values([
        { key: FEATURE_FLAGS.ERP_OPERATIONAL.key, value: String(enabled), updatedAt: new Date() },
        { key: FEATURE_FLAGS.ERP_MODULES.key, value: JSON.stringify([...new Set(modules)]), updatedAt: new Date() },
      ]).onConflictDoUpdate({ target: schema.systemSettings.key, set: { value: sql`excluded.value`, updatedAt: sql`excluded.updated_at` } });
      await tx.insert(schema.platformAuditLogs).values({ id: crypto.randomUUID(), actorUserId: admin.userId,
        action: "erp.platform.updated", targetType: "system_settings", targetId: FEATURE_FLAGS.ERP_OPERATIONAL.key,
        metadata: { enabled, modules }, createdAt: new Date() });
    });
    invalidateSystemSettingsCache(); revalidatePath("/super-admin/settings"); revalidatePath("/", "layout");
    return { message: "Disponibilidade do ERP atualizada. A ativação por empresa continua necessária." };
  });
}

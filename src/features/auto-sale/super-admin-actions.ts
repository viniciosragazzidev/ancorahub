"use server";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { readPilotConfig } from "@/features/global-catalog/pilot/server";
import { setSystemSetting } from "@/features/system-settings/queries";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { getDatabase, schema } from "@/shared/db";

import { autoSaleAutopilotSettingKey, autoSaleParamsSettingKey, autoSaleSettingKey } from "./flag";
import { autoSaleSettingsSchema } from "./settings";

async function target(tenantId: string) {
  const parsed = z.string().uuid().parse(tenantId);
  const [tenant] = await getDatabase().select({ id: schema.tenants.id }).from(schema.tenants).where(eq(schema.tenants.id, parsed)).limit(1);
  if (!tenant) throw new Error("Empresa não encontrada.");
  return tenant.id;
}

async function auditPlatform(actorUserId: string, tenantId: string, action: string, metadata: Record<string, unknown>) {
  await getDatabase().insert(schema.platformAuditLogs).values({ id: randomUUID(), actorUserId, action, targetType: "tenant", targetId: tenantId, metadata, createdAt: new Date() });
}

/**
 * Liga ou desliga a Venda Automatizada por empresa (DEC-182). Só liga se o catálogo de planos do piloto
 * é desta empresa (revisão do plano: sem catálogo, o agente não cota e a flag seria um falso "ligado").
 */
export async function updateAutoSaleTenantAction(tenantId: string, formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const input = z.object({ enabled: z.enum(["true", "false"]) }).parse({ enabled: formData.get("enabled") });
  const targetTenantId = await target(tenantId);
  if (input.enabled === "true") {
    const config = await readPilotConfig();
    if (!config?.enabled || config.tenantId !== targetTenantId) throw new Error("O catálogo de planos do piloto não é desta empresa. Libere o catálogo antes.");
  }
  await setSystemSetting(autoSaleSettingKey(targetTenantId), input.enabled, new Date());
  await auditPlatform(admin.userId, targetTenantId, "auto_sale.tenant_updated", { enabled: input.enabled === "true" });
  revalidatePath(`/super-admin/tenants/${targetTenantId}`);
}

export async function updateAutoSaleAutopilotAction(tenantId: string, formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const input = z.object({ enabled: z.enum(["true", "false"]) }).parse({ enabled: formData.get("enabled") });
  const targetTenantId = await target(tenantId);
  await setSystemSetting(autoSaleAutopilotSettingKey(targetTenantId), input.enabled, new Date());
  await auditPlatform(admin.userId, targetTenantId, "auto_sale.autopilot_updated", { enabled: input.enabled === "true" });
  revalidatePath(`/super-admin/tenants/${targetTenantId}`);
}

/** Parâmetros editáveis (rajada, limites, horário, áudio, prazo do gestor), validados e auditados. */
export async function updateAutoSaleParamsAction(tenantId: string, formData: FormData) {
  const admin = await getRequiredPlatformAdmin();
  const targetTenantId = await target(tenantId);
  const number = (key: string) => Number(formData.get(key));
  const settings = autoSaleSettingsSchema.parse({
    burstWaitSeconds: number("burstWaitSeconds"), messagesPerHour: number("messagesPerHour"), messagesPerDay: number("messagesPerDay"),
    sendStartHour: number("sendStartHour"), sendEndHour: number("sendEndHour"), audioPerDealPerDay: number("audioPerDealPerDay"),
    audioMaxSeconds: number("audioMaxSeconds"), idleManagerHours: number("idleManagerHours"),
    quoteLink: formData.get("quoteLink") === "on",
  });
  await setSystemSetting(autoSaleParamsSettingKey(targetTenantId), JSON.stringify(settings), new Date());
  await auditPlatform(admin.userId, targetTenantId, "auto_sale.params_updated", settings);
  revalidatePath(`/super-admin/tenants/${targetTenantId}`);
}

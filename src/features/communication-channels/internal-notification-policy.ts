import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";

export const internalBrokerDeliveryModes = ["meta_then_waha", "waha_direct"] as const;
export type InternalBrokerDeliveryMode = (typeof internalBrokerDeliveryModes)[number];

const policyInputSchema = z.object({
  enabled: z.boolean(),
  deliveryMode: z.enum(internalBrokerDeliveryModes),
  wahaNumberId: z.string().min(1).nullable(),
});

export function isInternalBrokerNotice(input: { recipientType: string; purpose: string }) {
  return input.recipientType === "user" && [
    "brokerLeadNotification",
    "newLeadAssignment",
    "leadAssignmentConfirmed",
    "leadAssignmentUnavailable",
    "leadAssignmentExpired",
  ].includes(input.purpose);
}

export async function getInternalBrokerNotificationPolicy(tenantId: string) {
  if ((await getSystemSetting("feature_waha_internal_broker_notifications_enabled")) === "false") {
    return { enabled: false, deliveryMode: "meta_then_waha" as const, wahaNumberId: null };
  }
  const [settings] = await getDatabase().select({
    enabled: schema.tenantInternalNotificationSettings.enabled,
    deliveryMode: schema.tenantInternalNotificationSettings.deliveryMode,
    wahaNumberId: schema.tenantInternalNotificationSettings.wahaNumberId,
  }).from(schema.tenantInternalNotificationSettings)
    .where(eq(schema.tenantInternalNotificationSettings.tenantId, tenantId)).limit(1);

  return settings ?? { enabled: true, deliveryMode: "meta_then_waha" as const, wahaNumberId: null };
}

export async function getSelectedInternalWahaNumber(tenantId: string, wahaNumberId: string | null) {
  if (!wahaNumberId) return null;
  const [number] = await getDatabase().select({
    id: schema.wahaNumbers.id,
    relaySessionId: schema.wahaNumbers.relaySessionId,
    displayPhoneNumber: schema.wahaNumbers.displayPhoneNumber,
    status: schema.wahaNumbers.status,
    capabilities: schema.wahaNumbers.capabilities,
  }).from(schema.wahaNumbers).where(and(
    eq(schema.wahaNumbers.id, wahaNumberId),
    eq(schema.wahaNumbers.tenantId, tenantId),
    eq(schema.wahaNumbers.scope, "tenant"),
    inArray(schema.wahaNumbers.status, ["active", "WORKING"]),
  )).limit(1);

  return number?.capabilities?.brokerFallback === false ? null : number ?? null;
}

export async function saveInternalBrokerNotificationPolicy(input: unknown) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Somente o Diretor pode configurar avisos internos.");
  const parsed = policyInputSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Configuração inválida.");
  const policy = parsed.data;
  const selected = await getSelectedInternalWahaNumber(context.tenantId, policy.wahaNumberId);
  if (policy.enabled && policy.deliveryMode === "waha_direct" && !selected) {
    throw new Error("Para enviar direto pelo WAHA, selecione um número da empresa conectado e ativo.");
  }
  if (policy.wahaNumberId && !selected) throw new Error("O número selecionado não está ativo ou não pertence à empresa.");

  const now = new Date();
  const db = getDatabase();
  await db.insert(schema.tenantInternalNotificationSettings).values({
    tenantId: context.tenantId,
    enabled: policy.enabled,
    deliveryMode: policy.deliveryMode,
    wahaNumberId: selected?.id ?? null,
    updatedBy: context.userId,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: schema.tenantInternalNotificationSettings.tenantId,
    set: { enabled: policy.enabled, deliveryMode: policy.deliveryMode, wahaNumberId: selected?.id ?? null, updatedBy: context.userId, updatedAt: now },
  });
  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "tenant_internal_notification_policy",
    entidadeId: context.tenantId,
    acao: `internal_broker_notifications.updated:${policy.enabled ? policy.deliveryMode : "disabled"}`,
    createdAt: now,
  });
  return { ...policy, wahaNumberId: selected?.id ?? null };
}

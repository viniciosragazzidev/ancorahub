import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

export const internalBrokerDeliveryModes = ["meta_then_waha", "waha_direct"] as const;
export type InternalBrokerDeliveryMode = (typeof internalBrokerDeliveryModes)[number];

const defaultInternalBrokerNotificationPolicy = {
  enabled: false,
  deliveryMode: "meta_then_waha" as const,
  wahaNumberId: null,
};

/** Keeps the integration page available while a rolling deployment finishes its database migration. */
export function isMissingInternalBrokerNotificationPolicyTable(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "42P01";
}

export function isInternalBrokerNotice(input: { recipientType: string; purpose?: string }) {
  return input.recipientType === "user";
}

export async function getInternalBrokerNotificationPolicy(tenantId: string) {
  // Kept as a compatibility read for older settings rows. Corporate
  // notifications are now always delivered by the official Meta channel.
  void tenantId;
  return defaultInternalBrokerNotificationPolicy;
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
    inArray(schema.wahaNumbers.status, ["active", "WORKING", "ready", "CONNECTED"]),
  )).limit(1);

  return number?.capabilities?.brokerFallback === false ? null : number ?? null;
}

export async function saveInternalBrokerNotificationPolicy(input: unknown) {
  void input;
  throw new Error("Avisos internos corporativos usam exclusivamente a API oficial Meta.");
}

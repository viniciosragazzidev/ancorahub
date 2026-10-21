import { and, eq, inArray, isNull, or, sql, type SQLWrapper } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { schema } from "@/shared/db";

export function isRecentWhatsAppReplyFilter(value: unknown): value is "7d" {
  return value === "7d";
}

/** Membership filter for the WhatsApp dashboard metric, using the signed-in role's report scope. */
export function brokerWhatsAppMembershipScope(input: {
  role: TenantContext["role"];
  branchId?: string | null;
  supervisedBrokerIds?: readonly string[] | null;
}) {
  if (input.role === "director") return undefined;
  if (input.role === "manager") {
    return input.branchId ? eq(schema.tenantMemberships.branchId, input.branchId) : null;
  }
  if (input.role === "supervisor") {
    const ids = input.supervisedBrokerIds;
    return ids?.length ? inArray(schema.tenantMemberships.userId, [...ids]) : null;
  }
  return null;
}

/**
 * A reply is personal when its stored connection belongs to the current broker.
 * Older rows have no source IDs, so retain the former owner/phone approximation
 * only for those rows; their seven-day window makes this fallback expire by itself.
 */
export function brokerWhatsAppMessageSourceCondition(input: {
  tenantId: string;
  brokerUserId: SQLWrapper;
  message: typeof schema.whatsappMessages;
}) {
  const { tenantId, brokerUserId, message } = input;
  const ownConnection = sql`exists (
    select 1 from ${schema.whatsappConnections}
    where ${schema.whatsappConnections.id} = ${message.whatsappConnectionId}
      and ${schema.whatsappConnections.tenantId} = ${tenantId}
      and ${schema.whatsappConnections.userId} = ${brokerUserId}
      and ${schema.whatsappConnections.status} = 'ready'
  )`;
  const brokerConnectionReady = sql`exists (
    select 1 from ${schema.whatsappConnections}
    where ${schema.whatsappConnections.tenantId} = ${tenantId}
      and ${schema.whatsappConnections.userId} = ${brokerUserId}
      and ${schema.whatsappConnections.status} = 'ready'
  )`;
  const legacyPersonalApproximation = and(
    brokerConnectionReady,
    eq(message.provider, "waha"),
    isNull(message.whatsappConnectionId),
    isNull(message.wahaNumberId),
    sql`not exists (
      select 1 from ${schema.wahaNumbers}
      where ${schema.wahaNumbers.tenantId} = ${tenantId}
        and length(regexp_replace(coalesce(${schema.wahaNumbers.displayPhoneNumber}, ''), '[^0-9]', '', 'g')) >= 9
        and length(regexp_replace(coalesce(${message.phone}, ''), '[^0-9]', '', 'g')) >= 9
        and right(regexp_replace(coalesce(${schema.wahaNumbers.displayPhoneNumber}, ''), '[^0-9]', '', 'g'), 9)
          = right(regexp_replace(coalesce(${message.phone}, ''), '[^0-9]', '', 'g'), 9)
    )`,
  );

  return and(eq(message.provider, "waha"), or(ownConnection, legacyPersonalApproximation))!;
}

import "server-only";

import { and, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import type { IdempotencyResolution } from "../types/lead-webhook.types";

export async function resolveLeadWebhookIdempotency(
  credentialId: string,
  idempotencyKey: string | null,
  externalId: string | null,
  payloadHash: string,
): Promise<IdempotencyResolution> {
  const db = getDatabase();

  // Priority 1: Idempotency-Key
  if (idempotencyKey) {
    const [existing] = await db
      .select({
        deliveryId: schema.webhookDeliveries.id,
        leadId: schema.webhookDeliveries.leadId,
        payloadHash: schema.webhookDeliveries.payloadHash,
      })
      .from(schema.webhookDeliveries)
      .where(
        and(
          eq(schema.webhookDeliveries.credentialId, credentialId),
          eq(schema.webhookDeliveries.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.payloadHash === payloadHash) {
        // Same key + same payload = replay
        return { status: "replay", leadId: existing.leadId! };
      }
      // Same key + different payload = conflict
      return { status: "conflict" };
    }
  }

  // Priority 2: externalId + credentialId
  if (externalId) {
    const [existingByExternal] = await db
      .select({ id: schema.leads.id })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.webhookCredentialId, credentialId),
          eq(schema.leads.externalId, externalId),
        ),
      )
      .limit(1);

    if (existingByExternal) {
      return { status: "replay", leadId: existingByExternal.id };
    }
  }

  return { status: "new" };
}

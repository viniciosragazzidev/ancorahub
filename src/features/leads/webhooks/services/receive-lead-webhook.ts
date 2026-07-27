import "server-only";

import { randomUUID } from "node:crypto";

import { getDatabase, schema } from "@/shared/db";
import { logger } from "@/shared/infra/logger";
import { leadWebhookPayloadSchema } from "../schemas/lead-webhook-payload.schema";
import {
  hashNormalizedWebhookPayload,
  normalizeWebhookLead,
} from "../utils/lead-webhook.utils";
import { authenticateLeadWebhook, WebhookAuthError } from "./authenticate-lead-webhook";
import { resolveLeadWebhookIdempotency } from "./resolve-lead-webhook-idempotency";
import { resolveWebhookBranch, WebhookBranchNotFoundError } from "./resolve-webhook-branch";
import { createLeadFromWebhook } from "./create-lead-from-webhook";
import type {
  ReceiveLeadWebhookInput,
  ReceiveLeadWebhookResult,
} from "../types/lead-webhook.types";

export async function receiveLeadWebhook(
  input: ReceiveLeadWebhookInput,
): Promise<ReceiveLeadWebhookResult> {
  const { pathTenantId, rawToken, payload, idempotencyKey, requestMetadata } = input;
  const { requestId, receivedAt } = requestMetadata;

  try {
    // ?? Step 1: Authenticate ??????????????????????????????????????????
    const credential = await authenticateLeadWebhook(rawToken, pathTenantId);
    const { tenantId, credentialId, createdBy, branchId: credentialBranchId } = credential;

    // ?? Step 2: Validate payload with Zod ??????????????????????????????
    const parsed = leadWebhookPayloadSchema.safeParse(payload);

    if (!parsed.success) {
      // Register rejected delivery
      const deliveryId = randomUUID();
      const payloadHash = hashNormalizedWebhookPayload(
        typeof payload === "object" && payload !== null
          ? (payload as Record<string, unknown>)
          : {},
      );

      try {
        await getDatabase().insert(schema.webhookDeliveries).values({
          id: deliveryId,
          tenantId,
          credentialId,
          requestId,
          idempotencyKey: idempotencyKey ?? null,
          externalId: null,
          payloadHash,
          status: "rejected",
          errorCode: "INVALID_PAYLOAD",
          receivedAt,
        });
      } catch {
        // Non-critical, do not fail
      }

      return {
        success: false,
        code: "INVALID_PAYLOAD",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      };
    }

    // ?? Step 3: Normalize data ????????????????????????????????????????
    const normalized = normalizeWebhookLead(parsed.data);

    // ?? Step 4: Generate payload hash ??????????????????????????????????
    const payloadHash = hashNormalizedWebhookPayload(
      parsed.data as unknown as Record<string, unknown>,
    );

    // ?? Step 5: Check idempotency ?????????????????????????????????????
    const idempotency = await resolveLeadWebhookIdempotency(
      credentialId,
      idempotencyKey,
      normalized.externalId,
      payloadHash,
    );

    if (idempotency.status === "replay") {
      return {
        success: true,
        leadId: idempotency.leadId,
        duplicate: true,
      };
    }

    if (idempotency.status === "conflict") {
      // Register rejected delivery for conflict
      const deliveryId = randomUUID();
      try {
        await getDatabase().insert(schema.webhookDeliveries).values({
          id: deliveryId,
          tenantId,
          credentialId,
          requestId,
          idempotencyKey: idempotencyKey ?? null,
          externalId: normalized.externalId,
          payloadHash,
          status: "rejected",
          errorCode: "IDEMPOTENCY_CONFLICT",
          receivedAt,
        });
      } catch {
        // Non-critical
      }

      return {
        success: false,
        code: "IDEMPOTENCY_CONFLICT",
      };
    }

    // ?? Step 6: Resolve branch ????????????????????????????????????????
    let branchId: string | null = null;
    try {
      branchId = credentialBranchId ?? await resolveWebhookBranch(tenantId, normalized.branchExternalId);
    } catch (error) {
      if (error instanceof WebhookBranchNotFoundError) {
        // Register rejected delivery
        const deliveryId = randomUUID();
        try {
          await getDatabase().insert(schema.webhookDeliveries).values({
            id: deliveryId,
            tenantId,
            credentialId,
            requestId,
            idempotencyKey: idempotencyKey ?? null,
            externalId: normalized.externalId,
            payloadHash,
            status: "rejected",
            errorCode: "BRANCH_NOT_FOUND",
            receivedAt,
          });
        } catch {
          // Non-critical
        }

        return {
          success: false,
          code: "BRANCH_NOT_FOUND",
        };
      }
      throw error;
    }

    // ?? Step 7: Create delivery record ????????????????????????????????
    const deliveryId = randomUUID();
    await getDatabase().insert(schema.webhookDeliveries).values({
      id: deliveryId,
      tenantId,
      credentialId,
      requestId,
      idempotencyKey: idempotencyKey ?? null,
      externalId: normalized.externalId,
      payloadHash,
      status: "received",
      receivedAt,
    });

    // ?? Step 8: Create lead in transaction ????????????????????????????
    const { leadId } = await createLeadFromWebhook({
      tenantId,
      branchId,
      credentialId,
      createdByUserId: createdBy,
      normalized,
      deliveryId,
    });

    return {
      success: true,
      leadId,
      duplicate: false,
    };
  } catch (error) {
    if (error instanceof WebhookAuthError) {
      return {
        success: false,
        code: "UNAUTHORIZED",
      };
    }

    // Unexpected error - return generic 500
    logger.error("lead_webhook_unexpected_error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      code: "INTERNAL_ERROR",
    };
  }
}

import type { z } from "zod";
import type { leadWebhookPayloadSchema } from "../schemas/lead-webhook-payload.schema";

export type LeadWebhookPayload = z.infer<typeof leadWebhookPayloadSchema>;

export type ReceiveLeadWebhookInput = {
  pathTenantId?: string;
  rawToken: string;
  payload: unknown;
  idempotencyKey: string | null;
  requestMetadata: {
    requestId: string;
    userAgent: string | null;
    receivedAt: Date;
  };
};

export type ReceiveLeadWebhookSuccess = {
  success: true;
  leadId: string;
  duplicate: boolean;
};

export type ReceiveLeadWebhookError = {
  success: false;
  code:
    | "UNAUTHORIZED"
    | "TENANT_INACTIVE"
    | "INVALID_PAYLOAD"
    | "BRANCH_NOT_FOUND"
    | "IDEMPOTENCY_CONFLICT"
    | "PAYLOAD_TOO_LARGE"
    | "RATE_LIMITED"
    | "INTERNAL_ERROR";
  issues?: Array<{ path: string; message: string }>;
};

export type ReceiveLeadWebhookResult =
  | ReceiveLeadWebhookSuccess
  | ReceiveLeadWebhookError;

export type IdempotencyResolution =
  | { status: "new" }
  | { status: "replay"; leadId: string }
  | { status: "conflict" };

export type AuthenticatedCredential = {
  credentialId: string;
  tenantId: string;
  branchId: string | null;
  tenantStatus: string;
};

export type NormalizedLeadData = {
  name: string;
  phone: string;
  email: string | null;
  source: string;
  planInterest: string | null;
  externalId: string | null;
  branchExternalId: string | null;
  metadata: Record<string, string | number | boolean | null> | null;
};

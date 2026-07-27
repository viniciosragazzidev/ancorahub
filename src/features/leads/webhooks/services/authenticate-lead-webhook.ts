import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { hashWebhookToken } from "../utils/lead-webhook.utils";
import type { AuthenticatedCredential } from "../types/lead-webhook.types";

export async function authenticateLeadWebhook(
  rawToken: string,
  pathTenantId?: string,
): Promise<AuthenticatedCredential & { createdBy: string }> {
  const tokenHash = hashWebhookToken(rawToken);
  const db = getDatabase();

  const [credential] = await db
    .select({
      credentialId: schema.leadWebhookCredentials.id,
      tenantId: schema.leadWebhookCredentials.tenantId,
      branchId: schema.leadWebhookCredentials.branchId,
      tenantStatus: schema.tenants.status,
      credentialStatus: schema.leadWebhookCredentials.status,
      expiresAt: schema.leadWebhookCredentials.expiresAt,
      revokedAt: schema.leadWebhookCredentials.revokedAt,
      createdBy: schema.leadWebhookCredentials.createdBy,
    })
    .from(schema.leadWebhookCredentials)
    .innerJoin(
      schema.tenants,
      eq(schema.leadWebhookCredentials.tenantId, schema.tenants.id),
    )
    .where(eq(schema.leadWebhookCredentials.tokenHash, tokenHash))
    .limit(1);

  if (!credential) {
    throw new WebhookAuthError();
  }

  // Validate credential status
  if (credential.credentialStatus !== "active") {
    throw new WebhookAuthError();
  }

  // Validate expiration
  if (credential.expiresAt && credential.expiresAt < new Date()) {
    throw new WebhookAuthError();
  }

  // Validate revocation
  if (credential.revokedAt) {
    throw new WebhookAuthError();
  }

  // Validate tenant status
  if (credential.tenantStatus !== "active") {
    throw new WebhookAuthError();
  }

  // Validate path tenant matches credential tenant
  if (pathTenantId && credential.tenantId !== pathTenantId) {
    throw new WebhookAuthError();
  }

  // Update lastUsedAt (fire-and-forget)
  try {
    await db
      .update(schema.leadWebhookCredentials)
      .set({ lastUsedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.leadWebhookCredentials.id, credential.credentialId));
  } catch {
    // Non-critical, do not fail the request
  }

  return {
    credentialId: credential.credentialId,
    tenantId: credential.tenantId,
    branchId: credential.branchId,
    tenantStatus: credential.tenantStatus,
    createdBy: credential.createdBy,
  };
}

export class WebhookAuthError extends Error {
  readonly code = "UNAUTHORIZED";
  constructor() {
    super("Credenciais inválidas.");
    this.name = "WebhookAuthError";
  }
}

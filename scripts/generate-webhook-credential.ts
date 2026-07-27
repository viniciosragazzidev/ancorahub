import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import { getDatabase, schema } from "../src/shared/db";
import { generateWebhookToken } from "../src/features/leads/webhooks/utils/lead-webhook.utils";

loadEnvConfig(process.cwd());

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main() {
  const tenantId = requireEnvironment("WEBHOOK_TENANT_ID");
  const credentialName = requireEnvironment("WEBHOOK_CREDENTIAL_NAME");
  const createdByUserId = requireEnvironment("WEBHOOK_CREATED_BY_USER_ID");
  const branchId = process.env.WEBHOOK_BRANCH_ID?.trim() || null;

  const db = getDatabase();

  // Validate tenant exists
  const [tenant] = await db
    .select({ id: schema.tenants.id, name: schema.tenants.name })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    console.error(`Tenant not found: ${tenantId}`);
    const tenants = await db
      .select({ id: schema.tenants.id, name: schema.tenants.name })
      .from(schema.tenants);
    console.log("Available tenants:");
    for (const t of tenants) {
      console.log(`  ${t.id} — ${t.name}`);
    }
    process.exitCode = 1;
    return;
  }

  // Generate token
  const { rawToken, tokenHash, tokenPrefix } = generateWebhookToken();

  const credentialId = randomUUID();
  await db.insert(schema.leadWebhookCredentials).values({
    id: credentialId,
    tenantId,
    branchId,
    name: credentialName,
    tokenPrefix,
    tokenHash,
    status: "active",
    createdBy: createdByUserId,
  });

  console.log("=".repeat(60));
  console.log("WEBHOOK CREDENTIAL CREATED");
  console.log("=".repeat(60));
  console.log(`  Tenant:       ${tenant.name} (${tenantId})`);
  console.log(`  Credential ID: ${credentialId}`);
  console.log(`  Name:          ${credentialName}`);
  console.log();
  console.log("  ⚠️  SAVE THIS TOKEN — IT WILL NOT BE SHOWN AGAIN:");
  console.log(`  ${rawToken}`);
  console.log();
  console.log(`  Prefix: ${tokenPrefix}`);
  console.log(`  Hash:   ${tokenHash}`);
  console.log("=".repeat(60));
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

loadEnvConfig(process.cwd());

class ProbeCompleted extends Error {}

type Membership = {
  tenantId: string;
  userId: string;
};

function stateHash() {
  return createHash("sha256").update(randomBytes(32)).digest("hex");
}

async function main() {
  const databaseUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("SUPABASE_DB_URL or DATABASE_URL is required for the Meta connection probe.");
  }

  const client = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    connect_timeout: 15,
  });

  try {
    const [membership] = await client<Membership[]>`
      SELECT tenant_id AS "tenantId", user_id AS "userId"
      FROM tenant_memberships
      LIMIT 1
    `;

    if (!membership) {
      throw new Error("The probe requires one tenant membership to validate the foreign keys.");
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const attemptId = randomUUID();

    try {
      await client.begin(async (transaction) => {
        const [created] = await transaction<{ id: string }[]>`
          INSERT INTO meta_connection_attempts (
            id,
            tenant_id,
            user_id,
            product,
            state_hash,
            status,
            expires_at,
            created_at,
            updated_at
          ) VALUES (
            ${attemptId},
            ${membership.tenantId},
            ${membership.userId},
            ${"marketing"},
            ${stateHash()},
            ${"pending"},
            ${expiresAt},
            ${now},
            ${now}
          )
          RETURNING id
        `;

        if (created?.id !== attemptId) {
          throw new Error("The Meta connection attempt was not persisted by the probe.");
        }

        throw new ProbeCompleted();
      });
    } catch (error) {
      if (!(error instanceof ProbeCompleted)) throw error;
    }

    console.log("OK meta_connection_attempts: insert validated and rolled back.");
  } finally {
    await client.end({ timeout: 5 });
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

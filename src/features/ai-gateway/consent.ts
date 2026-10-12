import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

/** Bump when the consent text changes: everyone is asked again. */
export const AI_CONSENT_VERSION = "2026-10-12";
export const AI_CONSENT_SCOPE = "broker_assistants" as const;

export type AiConsentDecision = "granted" | "declined" | "revoked";

/** The latest decision of the user; only a "granted" on the current version lets the AI run. */
export async function readAiConsent(tenantId: string, userId: string) {
  const [row] = await getDatabase()
    .select({ decision: schema.aiConsents.decision, termsVersion: schema.aiConsents.termsVersion, createdAt: schema.aiConsents.createdAt })
    .from(schema.aiConsents)
    .where(and(eq(schema.aiConsents.tenantId, tenantId), eq(schema.aiConsents.userId, userId), eq(schema.aiConsents.scope, AI_CONSENT_SCOPE)))
    .orderBy(desc(schema.aiConsents.createdAt), desc(schema.aiConsents.id))
    .limit(1);
  return {
    granted: row?.decision === "granted" && row.termsVersion === AI_CONSENT_VERSION,
    decision: (row?.decision ?? null) as AiConsentDecision | null,
  };
}

export async function recordAiConsent(input: { tenantId: string; userId: string; decision: AiConsentDecision }) {
  await getDatabase().insert(schema.aiConsents).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    userId: input.userId,
    scope: AI_CONSENT_SCOPE,
    termsVersion: AI_CONSENT_VERSION,
    decision: input.decision,
  });
}

import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { encryptMetaToken } from "./meta-oauth";
import type { MetaDiscoveredAssets } from "./types";

export const META_ATTEMPT_TTL_MS = 10 * 60 * 1000;
export type MetaConnectionProduct = "marketing" | "whatsapp";

export function hashMetaConnectionState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

export async function createMetaConnectionAttempt(input: { tenantId: string; userId: string; product: MetaConnectionProduct }) {
  const state = randomBytes(32).toString("base64url");
  const now = new Date();
  const attempt = {
    id: randomUUID(), tenantId: input.tenantId, userId: input.userId, product: input.product,
    stateHash: hashMetaConnectionState(state), status: "pending", expiresAt: new Date(now.getTime() + META_ATTEMPT_TTL_MS), createdAt: now, updatedAt: now,
  };
  await getDatabase().insert(schema.metaConnectionAttempts).values(attempt);
  return { id: attempt.id, state };
}

export async function completeMetaConnectionAttempt(input: { state: string; accessToken: string; assets: MetaDiscoveredAssets; tokenExpiresAt: Date | null }) {
  const db = getDatabase();
  const [attempt] = await db.select().from(schema.metaConnectionAttempts).where(and(
    eq(schema.metaConnectionAttempts.stateHash, hashMetaConnectionState(input.state)),
    eq(schema.metaConnectionAttempts.status, "pending"),
    gt(schema.metaConnectionAttempts.expiresAt, new Date()),
  )).limit(1);
  if (!attempt) throw new Error("A autorização Meta expirou ou já foi utilizada. Recomece a conexão.");
  if (attempt.product !== "marketing") throw new Error("Esta autorização não pertence ao conector de Marketing.");
  await db.update(schema.metaConnectionAttempts).set({
    status: "verified", accessTokenCiphertext: encryptMetaToken(input.accessToken), assetSnapshot: input.assets, tokenExpiresAt: input.tokenExpiresAt,
    updatedAt: new Date(),
  }).where(eq(schema.metaConnectionAttempts.id, attempt.id));
  return { id: attempt.id, tenantId: attempt.tenantId, userId: attempt.userId };
}

export async function readVerifiedMetaConnectionAttempt(input: { attemptId: string; tenantId: string; userId: string }) {
  const [attempt] = await getDatabase().select().from(schema.metaConnectionAttempts).where(and(
    eq(schema.metaConnectionAttempts.id, input.attemptId), eq(schema.metaConnectionAttempts.tenantId, input.tenantId),
    eq(schema.metaConnectionAttempts.userId, input.userId), eq(schema.metaConnectionAttempts.product, "marketing"),
    eq(schema.metaConnectionAttempts.status, "verified"), gt(schema.metaConnectionAttempts.expiresAt, new Date()),
  )).limit(1);
  if (!attempt?.accessTokenCiphertext || !attempt.assetSnapshot) throw new Error("A autorização Meta não está pronta para confirmação.");
  return attempt;
}

export async function consumeMetaConnectionAttempt(id: string) {
  await getDatabase().update(schema.metaConnectionAttempts).set({ status: "consumed", consumedAt: new Date(), updatedAt: new Date() }).where(eq(schema.metaConnectionAttempts.id, id));
}

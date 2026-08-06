import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

let schemaEnsured = false;

export async function ensureOnboardingProgressSchema() {
  if (schemaEnsured) return;
  try {
    const db = getDatabase();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_onboarding_progress (
        id text PRIMARY KEY,
        tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        tour_key text NOT NULL,
        version integer NOT NULL DEFAULT 1,
        status text NOT NULL DEFAULT 'not_started',
        current_step integer NOT NULL DEFAULT 0,
        started_at timestamp with time zone,
        completed_at timestamp with time zone,
        skipped_at timestamp with time zone,
        last_viewed_at timestamp with time zone,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS user_onboarding_progress_user_tour_version_unique 
      ON user_onboarding_progress (tenant_id, user_id, tour_key, version);
    `);
    schemaEnsured = true;
  } catch (err) {
    console.error("[ensureOnboardingProgressSchema] Failed DDL execution:", err);
  }
}

export type UserOnboardingStatus = "not_started" | "in_progress" | "completed" | "skipped" | "dismissed";

export async function getUserTourProgress(context: TenantContext, tourKey: string, version = 1) {
  await ensureOnboardingProgressSchema();
  const db = getDatabase();
  const [row] = await db
    .select()
    .from(schema.userOnboardingProgress)
    .where(
      and(
        eq(schema.userOnboardingProgress.tenantId, context.tenantId),
        eq(schema.userOnboardingProgress.userId, context.userId),
        eq(schema.userOnboardingProgress.tourKey, tourKey),
        eq(schema.userOnboardingProgress.version, version),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function updateUserTourProgress(
  context: TenantContext,
  input: {
    tourKey: string;
    version?: number;
    status: UserOnboardingStatus;
    currentStep?: number;
  },
) {
  await ensureOnboardingProgressSchema();
  const db = getDatabase();
  const now = new Date();
  const version = input.version ?? 1;

  const existing = await getUserTourProgress(context, input.tourKey, version);
  const currentStep = input.currentStep ?? existing?.currentStep ?? 0;

  if (existing) {
    await db
      .update(schema.userOnboardingProgress)
      .set({
        status: input.status,
        currentStep,
        lastViewedAt: now,
        startedAt: existing.startedAt ?? now,
        completedAt: input.status === "completed" ? now : existing.completedAt,
        skippedAt: input.status === "skipped" ? now : existing.skippedAt,
        updatedAt: now,
      })
      .where(eq(schema.userOnboardingProgress.id, existing.id));
  } else {
    await db.insert(schema.userOnboardingProgress).values({
      id: randomUUID(),
      tenantId: context.tenantId,
      userId: context.userId,
      tourKey: input.tourKey,
      version,
      status: input.status,
      currentStep,
      startedAt: now,
      completedAt: input.status === "completed" ? now : null,
      skippedAt: input.status === "skipped" ? now : null,
      lastViewedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { success: true };
}

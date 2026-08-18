"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";

export type ExperienceMode = "LIGHT" | "NORMAL";

const COOKIE_NAME = "ancora_experience_mode";

/**
 * Resolves the active experience mode for the current request.
 * Priorities:
 * 1. Explicit cookie value ("LIGHT" or "NORMAL")
 * 2. Persisted tenantMembership setting in DB
 * 3. Default: "LIGHT" for brokers, "NORMAL" for non-brokers
 */
export async function getExperienceMode(customContext?: TenantContext): Promise<ExperienceMode> {
  try {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(COOKIE_NAME)?.value;
    if (cookieVal === "LIGHT" || cookieVal === "NORMAL") {
      return cookieVal;
    }
  } catch {
    // If reading cookies fails outside request context, proceed to context check
  }

  let context = customContext;
  if (!context) {
    try {
      context = await getRequiredTenantContext();
    } catch {
      return "LIGHT";
    }
  }

  if (!context) return "LIGHT";

  try {
    const db = getDatabase();
    const [membership] = await db
      .select({ preferredExperienceMode: schema.tenantMemberships.preferredExperienceMode })
      .from(schema.tenantMemberships)
      .where(and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        eq(schema.tenantMemberships.userId, context.userId)
      ))
      .limit(1);

    if (membership?.preferredExperienceMode === "LIGHT" || membership?.preferredExperienceMode === "NORMAL") {
      return membership.preferredExperienceMode as ExperienceMode;
    }
  } catch {
    // Fallback if db column read fails
  }

  // Default: LIGHT for broker role/jobTitle, NORMAL for others
  const isBroker = context.role === "broker" || context.jobTitle === "broker";
  return isBroker ? "LIGHT" : "NORMAL";
}

/**
 * Server Action to switch experience mode (LIGHT <-> NORMAL)
 * Updates database and sets HTTP cookie.
 */
export async function setExperienceModeAction(newMode: ExperienceMode): Promise<{ success: boolean; mode: ExperienceMode; error?: string }> {
  try {
    const context = await getRequiredTenantContext();
    const mode: ExperienceMode = newMode === "NORMAL" ? "NORMAL" : "LIGHT";

    try {
      const db = getDatabase();
      await db
        .update(schema.tenantMemberships)
        .set({ preferredExperienceMode: mode })
        .where(and(
          eq(schema.tenantMemberships.tenantId, context.tenantId),
          eq(schema.tenantMemberships.userId, context.userId)
        ));
    } catch {
      // Non-fatal if schema mismatch
    }

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, mode, {
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
      sameSite: "lax",
    });

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/minha-fila");
    revalidatePath("/leads");

    return { success: true, mode };
  } catch (error) {
    return {
      success: false,
      mode: newMode,
      error: error instanceof Error ? error.message : "Não foi possível alterar o modo de uso.",
    };
  }
}

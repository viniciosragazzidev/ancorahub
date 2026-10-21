"use server";

import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";

export type ExperienceMode = "LIGHT" | "NORMAL";

const COOKIE_NAME = "ancora_experience_mode";

/**
 * The stored preference, read once per request: the layout, the page and the
 * rail all ask for the mode, and without a cookie each call was a round trip
 * through the small database pool.
 */
const readPreferredExperienceMode = cache(async (tenantId: string, userId: string) => {
  const [membership] = await getDatabase()
    .select({ preferredExperienceMode: schema.tenantMemberships.preferredExperienceMode })
    .from(schema.tenantMemberships)
    .where(and(
      eq(schema.tenantMemberships.tenantId, tenantId),
      eq(schema.tenantMemberships.userId, userId)
    ))
    .limit(1);
  return membership?.preferredExperienceMode ?? null;
});

/**
 * Resolves the active experience mode for the current request.
 * Priorities:
 * 1. Explicit cookie value ("LIGHT" or "NORMAL")
 * 2. Persisted tenantMembership setting in DB
 * 3. Default: "LIGHT" for brokers, "NORMAL" for non-brokers
 */
export async function getExperienceMode(customContext?: TenantContext): Promise<ExperienceMode> {
  let context = customContext;
  // Read the cookie first so a context failure cannot change prior behavior when the manager flag is off.
  let cookieVal: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieVal = cookieStore.get(COOKIE_NAME)?.value;
  } catch {
    // If reading cookies fails outside request context, proceed to context check
  }

  if (!context) {
    try {
      context = await getRequiredTenantContext();
    } catch {
      return cookieVal === "LIGHT" || cookieVal === "NORMAL" ? cookieVal : "LIGHT";
    }
  }

  if (context?.role === "manager") {
    const { FEATURE_FLAGS, getFeatureFlag } = await import("@/features/system-settings/queries");
    if ((await getFeatureFlag(FEATURE_FLAGS.MANAGER_LITE).catch(() => "false")) === "true") return "LIGHT";
  }

  if (cookieVal === "LIGHT" || cookieVal === "NORMAL") return cookieVal;

  if (!context) return "LIGHT";

  try {
    const preferred = await readPreferredExperienceMode(context.tenantId, context.userId);
    if (preferred === "LIGHT" || preferred === "NORMAL") {
      return preferred as ExperienceMode;
    }
  } catch {
    // Fallback if db column read fails
  }

  // Default: LIGHT for broker role/jobTitle, NORMAL for others
  const isBroker = context.role === "broker" || context.jobTitle === "broker";
  if (isBroker) return "LIGHT";
  // Supervisor Lite (team scope + flag): the supervisor starts in the Lite too.
  const { isSupervisorLiteAvailable } = await import("./lite-audience");
  if (await isSupervisorLiteAvailable(context)) return "LIGHT";
  return "NORMAL";
}

/**
 * Server Action to switch experience mode (LIGHT <-> NORMAL)
 * Updates database and sets HTTP cookie.
 */
export async function setExperienceModeAction(newMode: ExperienceMode): Promise<{ success: boolean; mode: ExperienceMode; error?: string }> {
  try {
    const context = await getRequiredTenantContext();
    const mode: ExperienceMode = newMode === "NORMAL" ? "NORMAL" : "LIGHT";

    if (context.role === "manager" && mode === "NORMAL") {
      const { FEATURE_FLAGS, getFeatureFlag } = await import("@/features/system-settings/queries");
      if ((await getFeatureFlag(FEATURE_FLAGS.MANAGER_LITE).catch(() => "false")) === "true") {
        return { success: false, mode: "LIGHT", error: "O modo Lite é obrigatório para gestores neste momento." };
      }
    }

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


    return { success: true, mode };
  } catch (error) {
    console.error("[broker-workspace] experience mode update failed", error);
    return {
      success: false,
      mode: newMode,
      error: "O modo de uso não foi alterado. Toque de novo.",
    };
  }
}

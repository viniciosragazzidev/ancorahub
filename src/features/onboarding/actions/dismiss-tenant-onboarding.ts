"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireAnyRole } from "@/shared/auth/authorization";
import { getDatabase, schema } from "@/shared/db";

export async function dismissTenantOnboarding(): Promise<{ success: boolean; error?: string }> {
  try {
    const context = requireAnyRole(
      await getRequiredTenantContext(),
      ["director", "manager"] as const,
    );

    const db = getDatabase();

    await db
      .update(schema.tenantMemberships)
      .set({
        onboardingDismissedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.tenantMemberships.tenantId, context.tenantId),
          eq(schema.tenantMemberships.userId, context.userId),
        ),
      );

    revalidatePath("/", "layout");

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao dispensar onboarding.";
    return { success: false, error: message };
  }
}

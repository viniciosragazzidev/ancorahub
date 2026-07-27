"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requireRole } from "@/shared/auth/authorization";
import { getDatabase, schema } from "@/shared/db";

type InitialSetupInput = {
  tenantName?: string;
  logoUrl?: string;
};

export async function completeInitialSetup(
  input: InitialSetupInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const context = requireRole(
      await getRequiredTenantContext(),
      "director",
    );

    const db = getDatabase();

    const updateData: Record<string, unknown> = {
      initialSetupCompletedAt: new Date(),
      updatedAt: new Date(),
    };

    if (input.tenantName !== undefined) {
      updateData.name = input.tenantName;
    }

    if (input.logoUrl !== undefined) {
      updateData.logoUrl = input.logoUrl || null;
    }

    await db
      .update(schema.tenants)
      .set(updateData)
      .where(eq(schema.tenants.id, context.tenantId));

    revalidatePath("/", "layout");

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro ao salvar configurações iniciais.";
    return { success: false, error: message };
  }
}

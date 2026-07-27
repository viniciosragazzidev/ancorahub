"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export async function updateTenantBrandingAction(
  _prev: { success: boolean; error?: string },
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") {
      return { success: false, error: "Apenas diretores podem alterar a identidade visual." };
    }

    const brandColor = String(formData.get("brandColor") ?? "").trim() || null;
    const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;

    if (brandColor && !/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
      return { success: false, error: "Cor inválida. Use o formato #RRGGBB." };
    }

    if (logoUrl && (!/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(logoUrl) && !/^https:\/\//.test(logoUrl))) {
      return { success: false, error: "Logo inválido. Use PNG, JPG, WebP ou uma URL HTTPS." };
    }
    if (logoUrl?.startsWith("data:") && logoUrl.length > 700_000) {
      return { success: false, error: "O logo deve ter no máximo 512 KB." };
    }

    const db = getDatabase();
    await db.transaction(async (tx) => {
      await tx.update(schema.tenants)
        .set({ brandColor, logoUrl, updatedAt: new Date() })
        .where(eq(schema.tenants.id, context.tenantId));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "tenant", entidadeId: context.tenantId, acao: "atualizou_identidade_visual",
      });
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao salvar identidade visual.";
    return { success: false, error: message };
  }
}

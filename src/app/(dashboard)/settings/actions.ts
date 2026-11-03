"use server";

import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { parseLogoPublicPath } from "@/features/tenant-branding/logo-file";
import { storeTenantLogo } from "@/features/tenant-branding/logo-storage";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { R2StorageConfigurationError } from "@/shared/storage/r2-storage";

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
    let logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;
    // The logo already stored for this company comes back as it is when only the color changes.
    const storedLogo = parseLogoPublicPath(logoUrl);

    if (brandColor && !/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
      return { success: false, error: "Cor inválida. Use o formato #RRGGBB." };
    }

    if (storedLogo && storedLogo.tenantId !== context.tenantId) {
      return { success: false, error: "Logo inválido. Use PNG, JPG, WebP ou uma URL HTTPS." };
    }
    if (logoUrl && !storedLogo && (!/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(logoUrl) && !/^https:\/\//.test(logoUrl))) {
      return { success: false, error: "Logo inválido. Use PNG, JPG, WebP ou uma URL HTTPS." };
    }
    if (logoUrl?.startsWith("data:") && logoUrl.length > 700_000) {
      return { success: false, error: "O logo deve ter no máximo 512 KB." };
    }

    // A logo vai para o R2 e `tenants.logo_url` guarda só o endereço (o layout lê essa linha em toda recarga).
    if (logoUrl?.startsWith("data:")) {
      try {
        logoUrl = await storeTenantLogo(context.tenantId, logoUrl);
      } catch (error) {
        // Sem R2 configurado (ambiente local), mantém o comportamento anterior em vez de bloquear a troca de logo.
        if (!(error instanceof R2StorageConfigurationError)) {
          console.error("[settings] falha ao salvar a logo no R2", error);
          return { success: false, error: "Não foi possível salvar a logo agora. Tente de novo em instantes." };
        }
      }
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

    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao salvar identidade visual.";
    return { success: false, error: message };
  }
}

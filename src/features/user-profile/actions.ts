"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { R2StorageConfigurationError } from "@/shared/storage/r2-storage";

import { storeUserAvatar } from "./avatar-storage";

const profileAction = z.enum([
  "atualizou_nome",
  "atualizou_avatar",
  "solicitou_verificacao_email",
  "alterou_senha",
  "encerrou_sessao",
  "encerrou_todas_sessoes",
]);

export async function recordProfileAuditAction(action: string) {
  const context = await getRequiredTenantContext();
  const parsed = profileAction.safeParse(action);
  if (!parsed.success) return { success: false as const, error: "Ação de perfil inválida." };

  await getDatabase().insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "user",
    entidadeId: context.userId,
    acao: parsed.data,
  });
  return { success: true as const };
}

const updateNameSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo.").max(80, "O nome é muito longo."),
});

export type ProfileActionState = { success?: boolean; error?: string };

export async function updateDisplayNameAction(_prev: ProfileActionState, formData: FormData) {
  const context = await getRequiredTenantContext();
  const parsed = updateNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nome inválido." };
  }

  const db = getDatabase();
  await db
    .update(schema.user)
    .set({ name: parsed.data.name, updatedAt: new Date() })
    .where(eq(schema.user.id, context.userId));

  await recordProfileAuditAction("atualizou_nome");
  return { success: true };
}

const updateAvatarSchema = z.object({
  avatar: z
    .string()
    .max(2_000_000, "A imagem é muito grande (máximo 2 MB).")
    .optional()
    .refine((value) => !value || /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(value), {
      message: "Formato de imagem inválido. Use PNG, JPG, WebP ou SVG.",
    }),
});

export async function updateAvatarAction(_prev: ProfileActionState, formData: FormData) {
  const context = await getRequiredTenantContext();
  const parsed = updateAvatarSchema.safeParse({ avatar: formData.get("avatar") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Imagem inválida." };
  }

  // A foto vai para o R2 e `user.image` guarda só o endereço (o login lê essa linha a cada requisição).
  let image: string | null = null;
  if (parsed.data.avatar) {
    try {
      image = await storeUserAvatar(context.userId, parsed.data.avatar);
    } catch (error) {
      // Sem R2 configurado (ambiente local), mantém o comportamento anterior em vez de bloquear a troca de foto.
      if (!(error instanceof R2StorageConfigurationError)) {
        console.error("[user-profile] falha ao salvar a foto no R2", error);
        return { error: "Não foi possível salvar a foto agora. Tente de novo em instantes." };
      }
      image = parsed.data.avatar;
    }
  }

  const db = getDatabase();
  await db
    .update(schema.user)
    .set({ image, updatedAt: new Date() })
    .where(eq(schema.user.id, context.userId));

  await recordProfileAuditAction("atualizou_avatar");
  return { success: true };
}

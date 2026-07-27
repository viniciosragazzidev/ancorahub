"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import type { PromotionalMaterialActionState } from "./types";

const materialInput = z.object({
  title: z.string().trim().min(2, "Informe o título do material.").max(200),
  description: z.string().trim().max(1000).optional(),
  category: z.enum([
    "avisos",
    "eventos",
    "informativos",
    "premiacoes",
    "promocoes",
    "treinamentos",
    "materiais_divulgacao",
  ]),
  imageUrl: z.string().url("URL da imagem inválida.").optional().or(z.literal("")),
  fileUrl: z.string().url("URL do arquivo inválida.").optional().or(z.literal("")),
  targetBranch: z.string().trim().max(120).optional().or(z.literal("")),
  targetCarrier: z.string().trim().max(120).optional().or(z.literal("")),
  targetState: z.string().trim().max(2).optional().or(z.literal("")),
  active: z.enum(["true", "false"]).default("true"),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

function formError(error: unknown): PromotionalMaterialActionState {
  if (error instanceof z.ZodError)
    return { error: error.issues[0]?.message ?? "Dados inválidos." };
  return {
    error:
      error instanceof Error
        ? error.message
        : "Não foi possível concluir a operação.",
  };
}

export async function createPromotionalMaterial(
  _prev: PromotionalMaterialActionState,
  formData: FormData,
): Promise<PromotionalMaterialActionState> {
  try {
    const context = await getRequiredTenantContext();
    requireRole(context, "director");

    const parsed = materialInput.safeParse({
      title: formData.get("title"),
      description: formData.get("description"),
      category: formData.get("category"),
      imageUrl: formData.get("imageUrl"),
      fileUrl: formData.get("fileUrl"),
      targetBranch: formData.get("targetBranch"),
      targetCarrier: formData.get("targetCarrier"),
      targetState: formData.get("targetState"),
      active: formData.get("active") ?? "true",
      sortOrder: formData.get("sortOrder") ?? "0",
    });

    if (!parsed.success) return formError(parsed.error);

    const db = getDatabase();
    const id = randomUUID();
    const data = parsed.data;

    await db.insert(schema.promotionalMaterials).values({
      id,
      tenantId: context.tenantId,
      title: data.title,
      description: data.description || null,
      category: data.category,
      imageUrl: data.imageUrl || null,
      fileUrl: data.fileUrl || null,
      targetBranch: data.targetBranch || null,
      targetCarrier: data.targetCarrier || null,
      targetState: data.targetState || null,
      active: data.active === "true",
      sortOrder: data.sortOrder,
      createdBy: context.userId,
    });

    revalidatePath("/super-admin/materiais-divulgacao");
    revalidatePath("/materiais-divulgacao");

    return { success: true };
  } catch (error) {
    return formError(error);
  }
}

export async function updatePromotionalMaterial(
  id: string,
  _prev: PromotionalMaterialActionState,
  formData: FormData,
): Promise<PromotionalMaterialActionState> {
  try {
    const context = await getRequiredTenantContext();
    requireRole(context, "director");

    const parsed = materialInput.safeParse({
      title: formData.get("title"),
      description: formData.get("description"),
      category: formData.get("category"),
      imageUrl: formData.get("imageUrl"),
      fileUrl: formData.get("fileUrl"),
      targetBranch: formData.get("targetBranch"),
      targetCarrier: formData.get("targetCarrier"),
      targetState: formData.get("targetState"),
      active: formData.get("active") ?? "true",
      sortOrder: formData.get("sortOrder") ?? "0",
    });

    if (!parsed.success) return formError(parsed.error);

    const db = getDatabase();
    const data = parsed.data;

    await db
      .update(schema.promotionalMaterials)
      .set({
        title: data.title,
        description: data.description || null,
        category: data.category,
        imageUrl: data.imageUrl || null,
        fileUrl: data.fileUrl || null,
        targetBranch: data.targetBranch || null,
        targetCarrier: data.targetCarrier || null,
        targetState: data.targetState || null,
        active: data.active === "true",
        sortOrder: data.sortOrder,
      })
      .where(
        and(
          eq(schema.promotionalMaterials.id, id),
          eq(schema.promotionalMaterials.tenantId, context.tenantId),
        ),
      );

    revalidatePath("/super-admin/materiais-divulgacao");
    revalidatePath("/materiais-divulgacao");

    return { success: true };
  } catch (error) {
    return formError(error);
  }
}

export async function togglePromotionalMaterialActive(
  id: string,
  active: boolean,
): Promise<PromotionalMaterialActionState> {
  try {
    const context = await getRequiredTenantContext();
    requireRole(context, "director");

    const db = getDatabase();

    await db
      .update(schema.promotionalMaterials)
      .set({ active })
      .where(
        and(
          eq(schema.promotionalMaterials.id, id),
          eq(schema.promotionalMaterials.tenantId, context.tenantId),
        ),
      );

    revalidatePath("/super-admin/materiais-divulgacao");
    revalidatePath("/materiais-divulgacao");

    return { success: true };
  } catch (error) {
    return formError(error);
  }
}

export async function deletePromotionalMaterial(
  id: string,
): Promise<PromotionalMaterialActionState> {
  try {
    const context = await getRequiredTenantContext();
    requireRole(context, "director");

    const db = getDatabase();

    await db
      .delete(schema.promotionalMaterials)
      .where(
        and(
          eq(schema.promotionalMaterials.id, id),
          eq(schema.promotionalMaterials.tenantId, context.tenantId),
        ),
      );

    revalidatePath("/super-admin/materiais-divulgacao");
    revalidatePath("/materiais-divulgacao");

    return { success: true };
  } catch (error) {
    return formError(error);
  }
}

import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import type { PromotionalMaterialCategory } from "./types";

export async function listPromotionalMaterials(
  filters?: {
    category?: PromotionalMaterialCategory;
    active?: boolean;
  },
) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const conditions = [eq(schema.promotionalMaterials.tenantId, context.tenantId)];

  if (filters?.category && filters.category !== "todos") {
    conditions.push(eq(schema.promotionalMaterials.category, filters.category));
  }

  if (filters?.active !== undefined) {
    conditions.push(eq(schema.promotionalMaterials.active, filters.active));
  }

  return db
    .select({
      id: schema.promotionalMaterials.id,
      title: schema.promotionalMaterials.title,
      description: schema.promotionalMaterials.description,
      category: schema.promotionalMaterials.category,
      imageUrl: schema.promotionalMaterials.imageUrl,
      fileUrl: schema.promotionalMaterials.fileUrl,
      targetBranch: schema.promotionalMaterials.targetBranch,
      targetCarrier: schema.promotionalMaterials.targetCarrier,
      targetState: schema.promotionalMaterials.targetState,
      active: schema.promotionalMaterials.active,
      sortOrder: schema.promotionalMaterials.sortOrder,
      createdAt: schema.promotionalMaterials.createdAt,
      createdBy: schema.promotionalMaterials.createdBy,
      createdByName: schema.user.name,
    })
    .from(schema.promotionalMaterials)
    .leftJoin(schema.user, eq(schema.promotionalMaterials.createdBy, schema.user.id))
    .where(and(...conditions))
    .orderBy(asc(schema.promotionalMaterials.sortOrder), asc(schema.promotionalMaterials.createdAt));
}

export async function listAllPromotionalMaterialsForAdmin() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  return db
    .select({
      id: schema.promotionalMaterials.id,
      title: schema.promotionalMaterials.title,
      description: schema.promotionalMaterials.description,
      category: schema.promotionalMaterials.category,
      imageUrl: schema.promotionalMaterials.imageUrl,
      fileUrl: schema.promotionalMaterials.fileUrl,
      targetBranch: schema.promotionalMaterials.targetBranch,
      targetCarrier: schema.promotionalMaterials.targetCarrier,
      targetState: schema.promotionalMaterials.targetState,
      active: schema.promotionalMaterials.active,
      sortOrder: schema.promotionalMaterials.sortOrder,
      createdAt: schema.promotionalMaterials.createdAt,
      updatedAt: schema.promotionalMaterials.updatedAt,
      createdBy: schema.promotionalMaterials.createdBy,
      createdByName: schema.user.name,
    })
    .from(schema.promotionalMaterials)
    .leftJoin(schema.user, eq(schema.promotionalMaterials.createdBy, schema.user.id))
    .where(eq(schema.promotionalMaterials.tenantId, context.tenantId))
    .orderBy(asc(schema.promotionalMaterials.sortOrder), asc(schema.promotionalMaterials.createdAt));
}

export async function getPromotionalMaterialById(id: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const rows = await db
    .select()
    .from(schema.promotionalMaterials)
    .where(
      and(
        eq(schema.promotionalMaterials.id, id),
        eq(schema.promotionalMaterials.tenantId, context.tenantId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

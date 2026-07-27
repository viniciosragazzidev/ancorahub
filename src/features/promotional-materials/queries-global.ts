import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

export async function listAllMaterialsGlobally() {
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
      tenantId: schema.promotionalMaterials.tenantId,
      tenantName: schema.tenants.name,
    })
    .from(schema.promotionalMaterials)
    .leftJoin(schema.user, eq(schema.promotionalMaterials.createdBy, schema.user.id))
    .leftJoin(schema.tenants, eq(schema.promotionalMaterials.tenantId, schema.tenants.id))
    .orderBy(asc(schema.promotionalMaterials.tenantId), asc(schema.promotionalMaterials.sortOrder));
}

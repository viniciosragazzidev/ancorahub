import "server-only";

import { and, eq } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export async function getActiveTemplates(category?: string) {
  const context = await getRequiredTenantContext();
  const conditions = [
    eq(schema.messageTemplates.tenantId, context.tenantId),
    eq(schema.messageTemplates.active, true),
  ];

  if (category) {
    conditions.push(eq(schema.messageTemplates.category, category));
  }

  return getDatabase()
    .select({
      id: schema.messageTemplates.id,
      name: schema.messageTemplates.name,
      category: schema.messageTemplates.category,
      content: schema.messageTemplates.content,
      variables: schema.messageTemplates.variables,
    })
    .from(schema.messageTemplates)
    .where(and(...conditions))
    .orderBy(schema.messageTemplates.name);
}

export async function getTemplateById(id: string) {
  const context = await getRequiredTenantContext();

  const [template] = await getDatabase()
    .select({
      id: schema.messageTemplates.id,
      name: schema.messageTemplates.name,
      category: schema.messageTemplates.category,
      content: schema.messageTemplates.content,
      variables: schema.messageTemplates.variables,
    })
    .from(schema.messageTemplates)
    .where(and(eq(schema.messageTemplates.id, id), eq(schema.messageTemplates.tenantId, context.tenantId)))
    .limit(1);

  return template ?? null;
}

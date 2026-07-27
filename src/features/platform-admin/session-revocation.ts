import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

/**
 * Revoga todas as sessões de um usuário específico.
 * Usado quando: alteração de senha, inativação de membro.
 */
export async function revokeUserSessions(userId: string, reason: string) {
  const db = getDatabase();
  await db.delete(schema.session).where(eq(schema.session.userId, userId));
}

/**
 * Revoga todas as sessões de todos os membros de um tenant.
 * Usado quando: suspensão do tenant.
 */
export async function revokeTenantSessions(tenantId: string, reason: string) {
  const db = getDatabase();
  const members = await db
    .select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .where(eq(schema.tenantMemberships.tenantId, tenantId));

  const userIds = members.map((m) => m.userId);
  if (userIds.length === 0) return { revoked: 0 };

  for (const userId of userIds) {
    await db.delete(schema.session).where(eq(schema.session.userId, userId));
  }

  return { revoked: userIds.length };
}

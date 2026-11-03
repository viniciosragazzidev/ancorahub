import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";

/** Há alguma sessão de extensão ativa (não revogada e não vencida) deste usuário nesta empresa. */
export async function sessaoExtensaoAtiva(userId: string, tenantId: string, agora = new Date()) {
  const [sessao] = await getDatabase()
    .select({ id: schema.extensionSessions.id })
    .from(schema.extensionSessions)
    .where(and(
      eq(schema.extensionSessions.userId, userId),
      eq(schema.extensionSessions.tenantId, tenantId),
      isNull(schema.extensionSessions.revokedAt),
      gt(schema.extensionSessions.expiresAt, agora),
    ))
    .limit(1);
  return Boolean(sessao);
}

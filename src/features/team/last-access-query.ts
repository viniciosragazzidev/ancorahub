import "server-only";

import { inArray, max, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

/**
 * Último acesso de várias pessoas numa consulta só (sem N+1): a sessão mais recente de cada userId, agregada na
 * tabela session. Quem chama passa só os userIds que a própria tela já filtrou pelo escopo (diretor: empresa;
 * gestor: unidade; supervisor: equipe), então ninguém de fora entra na conta.
 *
 * Devolve null quando a consulta falha: a tela some com a informação em vez de dizer "Nunca entrou" para todos.
 */
export async function getLastAccessByUser(userIds: Array<string | null | undefined>, label = "equipe"): Promise<Map<string, string | null> | null> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return new Map();
  try {
    const rows = await getDatabase()
      .select({ userId: schema.session.userId, lastAccessAt: max(sql<Date>`greatest(${schema.session.createdAt}, ${schema.session.updatedAt})`) })
      .from(schema.session)
      .where(inArray(schema.session.userId, ids))
      .groupBy(schema.session.userId);
    return new Map(rows.map((row) => [row.userId, row.lastAccessAt ? new Date(row.lastAccessAt).toISOString() : null]));
  } catch (error) {
    console.error(`[${label}] last access unavailable`, error instanceof Error ? error.message : error);
    return null;
  }
}


import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

/** Primeiro nome para a saudação do cabeçalho compartilhado do painel. */
export async function getDirectorLiteViewerFirstName(userId: string): Promise<string | null> {
  const [row] = await getDatabase()
    .select({ name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);

  return row?.name.trim().split(/\s+/)[0] ?? null;
}

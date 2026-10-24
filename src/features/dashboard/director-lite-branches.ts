import "server-only";

import { asc, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

/** Unidades do tenant para o filtro "Unidade" do painel do diretor. Nunca lê outra empresa. */
export async function listDashboardBranches(tenantId: string) {
  return getDatabase()
    .select({ id: schema.branches.id, name: schema.branches.name })
    .from(schema.branches)
    .where(eq(schema.branches.tenantId, tenantId))
    .orderBy(asc(schema.branches.name));
}

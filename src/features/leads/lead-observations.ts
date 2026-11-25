import "server-only";

import { and, desc, eq, isNull, or, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import { LEAD_OBSERVATIONS_LIMIT, observationFromInteraction, type LeadObservation } from "./lead-observations-core";

export type { LeadObservation } from "./lead-observations-core";

/**
 * As observações das etapas de um lead, da mais nova para a mais antiga, para o corretor responsável.
 * Escopo vem só do contexto autenticado: mesma empresa e lead com o próprio corretor (atendimento ou carteira).
 * Fora disso, lista vazia. Uma consulta.
 */
export async function listLeadObservations(viewer: { tenantId: string; userId: string }, leadId: string): Promise<LeadObservation[]> {
  const rows = await getDatabase()
    .select({
      id: schema.leadInteractions.id,
      conteudo: schema.leadInteractions.conteudo,
      metadata: schema.leadInteractions.metadata,
      createdAt: schema.leadInteractions.createdAt,
      authorName: schema.user.name,
    })
    .from(schema.leadInteractions)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.leadInteractions.leadId))
    .leftJoin(schema.user, eq(schema.user.id, schema.leadInteractions.userId))
    .where(and(
      eq(schema.leads.id, leadId),
      eq(schema.leads.tenantId, viewer.tenantId),
      eq(schema.leads.corretorId, viewer.userId),
      isNull(schema.leads.deletedAt),
      eq(schema.leadInteractions.tipo, "status_change"),
      or(
        sql`${schema.leadInteractions.metadata}->>'observation' is not null`,
        sql`${schema.leadInteractions.conteudo} like '%Observação:%'`,
        sql`${schema.leadInteractions.conteudo} like '%Como foi o contato:%'`,
      ),
    ))
    .orderBy(desc(schema.leadInteractions.createdAt), desc(schema.leadInteractions.id))
    .limit(LEAD_OBSERVATIONS_LIMIT);
  return rows.flatMap((row) => {
    const found = observationFromInteraction(row);
    return found ? [{ id: row.id, ...found, authorName: row.authorName ?? null, createdAt: row.createdAt.toISOString() }] : [];
  });
}

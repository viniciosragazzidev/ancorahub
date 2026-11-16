import { sql, type SQL } from "drizzle-orm";

import { schema } from "@/shared/db";

/**
 * Lista interna da equipe (16/11/2026): leads que a supervisão importou ficam com a equipe. Diretor e gestor só
 * enxergam os que o cliente já respondeu (mensagem recebida no WhatsApp), e com a marca "Lead de equipe".
 * Mesmo valor de `SUPERVISOR_IMPORT_SOURCE` (service.ts), aqui sem "server-only" para servir a qualquer consulta.
 */
export const TEAM_LIST_SOURCE = "supervisor_import";

type LeadsTable = typeof schema.leads;

export function isTeamListLead(table: LeadsTable = schema.leads): SQL {
  return sql`coalesce(${table.sourceChannel} = ${TEAM_LIST_SOURCE}, false)`;
}

/** O cliente já mandou alguma mensagem para o corretor. */
export function teamListClientReplied(table: LeadsTable = schema.leads): SQL {
  return sql`exists (select 1 from whatsapp_messages wm where wm.tenant_id = ${table.tenantId} and wm.lead_id = ${table.id} and wm.direction in ('incoming', 'inbound'))`;
}

/** Filtro das telas da gestão: lead comum sempre; lead da lista da equipe só depois que o cliente respondeu. */
export function visibleToManagement(table: LeadsTable = schema.leads): SQL {
  return sql`(${table.sourceChannel} is distinct from ${TEAM_LIST_SOURCE} or ${teamListClientReplied(table)})`;
}

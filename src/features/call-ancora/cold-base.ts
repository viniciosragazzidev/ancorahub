import "server-only";

import { and, asc, eq, isNull, notInArray, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import type { CallAncoraContact } from "./contacts";
import { normalizeBrPhone } from "./test-list";

/**
 * Base geral de frios do Call Âncora: todo lead frio do tenant (qualification_status = cold)
 * sem corretor, aberto (sem perda/venda), não arquivado, não apagado e não removido da
 * distribuição, INCLUSIVE os segurados (distribution_status = manual_hold). Sem esperar os
 * 2 dias da liberação das 9h. Ligar não muda o estado do lead; só "Com interesse" atribui.
 * Leitura apenas.
 *
 * Fora do pool: telefone brasileiro inválido, "Número errado" já marcado no Call Âncora,
 * tentativa do Call Âncora há menos de 4 h e leads com 3 tentativas.
 */
export const COLD_ATTEMPT_COOLDOWN_MS = 4 * 60 * 60_000;
export const COLD_MAX_ATTEMPTS = 3;
export const COLD_PAGE_SIZE = 20;
/** Reserva de um lead para uma sessão: some sozinha depois disto. */
export const COLD_RESERVATION_TTL_MS = 10 * 60_000;
/** Marca dos registros do Call Âncora em lead_interactions.metadata.source. */
export const CALL_ANCORA_SOURCE = "call_ancora";

const callAncoraAttempts = (leadId: typeof schema.leads.id) => sql`(
  select count(*)::int from ${schema.leadInteractions} i
  where i.lead_id = ${leadId} and i.metadata->>'source' = ${CALL_ANCORA_SOURCE}
)`;

/** O lead ainda está livre (sem corretor, aberto, não arquivado)? Leitura na hora de entregar ao celular. */
export async function isColdLeadStillFree(tenantId: string, leadId: string): Promise<boolean> {
  const [lead] = await getDatabase()
    .select({ id: schema.leads.id })
    .from(schema.leads)
    .where(and(
      eq(schema.leads.tenantId, tenantId),
      eq(schema.leads.id, leadId),
      isNull(schema.leads.corretorId),
      isNull(schema.leads.deletedAt),
      isNull(schema.leads.archivedAt),
      notInArray(schema.leads.status, ["lost", "converted"]),
    ))
    .limit(1);
  return Boolean(lead);
}

/** Página de frios elegíveis, do mais antigo para o mais novo. */
export async function fetchColdCandidates(input: {
  tenantId: string;
  excludeLeadIds: string[];
  limit?: number;
  now?: Date;
}): Promise<CallAncoraContact[]> {
  const now = input.now ?? new Date();
  const cooldownSince = new Date(now.getTime() - COLD_ATTEMPT_COOLDOWN_MS);
  const limit = input.limit ?? COLD_PAGE_SIZE;
  const rows = await getDatabase()
    .select({ id: schema.leads.id, nome: schema.leads.nome, telefone: schema.leads.telefone })
    .from(schema.leads)
    .where(and(
      eq(schema.leads.tenantId, input.tenantId),
      eq(schema.leads.qualificationStatus, "cold"),
      isNull(schema.leads.corretorId),
      isNull(schema.leads.deletedAt),
      isNull(schema.leads.archivedAt),
      isNull(schema.leads.distributionRemovedAt),
      notInArray(schema.leads.status, ["lost", "converted"]),
      input.excludeLeadIds.length ? notInArray(schema.leads.id, input.excludeLeadIds) : undefined,
      sql`not exists (
        select 1 from ${schema.leadInteractions} i
        where i.lead_id = ${schema.leads.id}
          and i.metadata->>'source' = ${CALL_ANCORA_SOURCE}
          and (i.metadata->>'outcome' = 'wrong_number' or i.created_at > ${cooldownSince.toISOString()}::timestamptz)
      )`,
      sql`${callAncoraAttempts(schema.leads.id)} < ${COLD_MAX_ATTEMPTS}`,
    ))
    .orderBy(asc(schema.leads.createdAt), asc(schema.leads.id))
    // Busca um pouco mais para compensar telefones inválidos.
    .limit(limit * 3);

  const contacts: CallAncoraContact[] = [];
  for (const row of rows) {
    const phone = normalizeBrPhone(row.telefone);
    if (!phone) continue;
    contacts.push({ id: row.id, name: row.nome, phone, source: "cold_base", dialable: true });
    if (contacts.length >= limit) break;
  }
  return contacts;
}

/**
 * Reservas em memória por tenant (uma instância no Coolify): duas sessões ativas nunca
 * recebem o mesmo lead ao mesmo tempo. Expira em 10 min ou quando a sessão solta.
 */
type Reservation = { sessionKey: string; expiresAt: number };

export class ColdReservations {
  private readonly byTenant = new Map<string, Map<string, Reservation>>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  private tenant(tenantId: string) {
    let map = this.byTenant.get(tenantId);
    if (!map) {
      map = new Map();
      this.byTenant.set(tenantId, map);
    }
    const now = this.now();
    for (const [leadId, reservation] of map) if (reservation.expiresAt <= now) map.delete(leadId);
    return map;
  }

  /** Leads reservados por outras sessões (não podem entrar nesta). */
  heldByOthers(tenantId: string, sessionKey: string): string[] {
    return [...this.tenant(tenantId)].filter(([, r]) => r.sessionKey !== sessionKey).map(([leadId]) => leadId);
  }

  /** Reserva se estiver livre (ou já for desta sessão). */
  tryReserve(tenantId: string, sessionKey: string, leadId: string): boolean {
    const map = this.tenant(tenantId);
    const existing = map.get(leadId);
    if (existing && existing.sessionKey !== sessionKey) return false;
    map.set(leadId, { sessionKey, expiresAt: this.now() + COLD_RESERVATION_TTL_MS });
    return true;
  }

  /** Renova as reservas que a sessão ainda segura (atual + próximo). */
  renew(tenantId: string, sessionKey: string, leadIds: string[]) {
    const map = this.tenant(tenantId);
    for (const leadId of leadIds) {
      const existing = map.get(leadId);
      if (existing?.sessionKey === sessionKey) existing.expiresAt = this.now() + COLD_RESERVATION_TTL_MS;
    }
  }

  release(tenantId: string, leadId: string) {
    this.tenant(tenantId).delete(leadId);
  }

  /** Solta tudo o que a sessão segura, menos `keep`. */
  releaseSession(tenantId: string, sessionKey: string, keep: string[] = []) {
    const map = this.tenant(tenantId);
    for (const [leadId, reservation] of map) {
      if (reservation.sessionKey === sessionKey && !keep.includes(leadId)) map.delete(leadId);
    }
  }
}

const globalReservations = globalThis as typeof globalThis & { __callAncoraColdReservations?: ColdReservations };
export const coldReservations = globalReservations.__callAncoraColdReservations ??= new ColdReservations();

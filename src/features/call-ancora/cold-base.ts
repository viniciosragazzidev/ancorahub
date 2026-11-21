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
  /** Regras da tela do diretor (período dos leads, tentativas, intervalo). Sem elas, o padrão. */
  rules?: { maxAgeDays: number; minAgeDays: number; maxAttempts: number; cooldownMs: number };
  /**
   * Recuperação, fase 4 (fila "Sem resposta" ligada): a fila de ligação vem primeiro, pela pontuação (A4 antes de
   * D1), e entra mesmo sem estar fria (quem parou no meio). O resto da base de frios segue depois, como hoje.
   */
  recoveryQueueFirst?: boolean;
}): Promise<CallAncoraContact[]> {
  const now = input.now ?? new Date();
  const rules = input.rules;
  const cooldownSince = new Date(now.getTime() - (rules?.cooldownMs ?? COLD_ATTEMPT_COOLDOWN_MS));
  const maxAttempts = rules?.maxAttempts ?? COLD_MAX_ATTEMPTS;
  const day = 24 * 60 * 60_000;
  const createdAfter = rules ? new Date(now.getTime() - rules.maxAgeDays * day) : null;
  const createdBefore = rules && rules.minAgeDays > 0 ? new Date(now.getTime() - rules.minAgeDays * day) : null;
  const limit = input.limit ?? COLD_PAGE_SIZE;
  const rows = await getDatabase()
    .select({ id: schema.leads.id, nome: schema.leads.nome, telefone: schema.leads.telefone })
    .from(schema.leads)
    .where(and(
      eq(schema.leads.tenantId, input.tenantId),
      input.recoveryQueueFirst
        ? sql`(${schema.leads.qualificationStatus} = 'cold' or ${schema.leads.qualificationDetails}->'recovery'->>'state' = 'call_queue')`
        : eq(schema.leads.qualificationStatus, "cold"),
      // Nutrição, momento ruim e "Não contatar" (marcas da recuperação) ficam fora da base.
      sql`coalesce(${schema.leads.qualificationDetails}->'recovery'->>'state', '') not in ('nurture', 'bad_moment', 'do_not_contact')`,
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
      sql`${callAncoraAttempts(schema.leads.id)} < ${maxAttempts}`,
      // Pedido de parar ou número errado já registrados na conversa da IA.
      sql`not exists (
        select 1 from ${schema.aiConversations} c
        where c.lead_id = ${schema.leads.id} and (c.opt_out_at is not null or c.wrong_number_at is not null)
      )`,
      createdAfter ? sql`${schema.leads.createdAt} >= ${createdAfter.toISOString()}::timestamptz` : undefined,
      createdBefore ? sql`${schema.leads.createdAt} <= ${createdBefore.toISOString()}::timestamptz` : undefined,
    ))
    .orderBy(...(input.recoveryQueueFirst
      ? [
        sql`(${schema.leads.qualificationDetails}->'recovery'->>'state' = 'call_queue') desc nulls last`,
        sql`(${schema.leads.qualificationDetails}->'recovery'->>'rank')::int desc nulls last`,
      ]
      : []), asc(schema.leads.createdAt), asc(schema.leads.id))
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
type Reservation = { sessionKey: string; expiresAt: number; phone: string | null };

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

  /**
   * Reserva se estiver livre (ou já for desta sessão). Com `phone`, também recusa quando o
   * mesmo número (outro lead do tenant) já está reservado: nunca duas ligações ao mesmo número.
   */
  tryReserve(tenantId: string, sessionKey: string, leadId: string, phone: string | null = null): boolean {
    const map = this.tenant(tenantId);
    const existing = map.get(leadId);
    if (existing && existing.sessionKey !== sessionKey) return false;
    if (phone) {
      for (const [otherId, reservation] of map) {
        if (otherId !== leadId && reservation.phone === phone) return false;
      }
    }
    map.set(leadId, { sessionKey, expiresAt: this.now() + COLD_RESERVATION_TTL_MS, phone });
    return true;
  }

  /** O lead está reservado por alguma sessão do Call Âncora agora? */
  isHeld(tenantId: string, leadId: string): boolean {
    return this.tenant(tenantId).has(leadId);
  }

  /** Renova as reservas que a sessão segura (atual + próximo); recria se sumiram (reinício). */
  renew(tenantId: string, sessionKey: string, leadIds: string[]) {
    const map = this.tenant(tenantId);
    for (const leadId of leadIds) {
      const existing = map.get(leadId);
      if (existing?.sessionKey === sessionKey) existing.expiresAt = this.now() + COLD_RESERVATION_TTL_MS;
      else if (!existing) map.set(leadId, { sessionKey, expiresAt: this.now() + COLD_RESERVATION_TTL_MS, phone: null });
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

/**
 * Para a distribuição (liberação das 9h e fila automática) e a requalificação de frios:
 * true quando o lead está reservado para uma ligação do Call Âncora neste momento.
 * Uma instância só (Coolify): a reserva vive no mesmo processo que os jobs.
 */
export function isLeadHeldByCallAncora(tenantId: string, leadId: string): boolean {
  return coldReservations.isHeld(tenantId, leadId);
}

export const CALL_ANCORA_HOLD_REASON = "O lead está numa ligação do Call Âncora agora; a distribuição tenta de novo depois.";

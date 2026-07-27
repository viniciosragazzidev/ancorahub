import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, lt, isNull, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
/**
 * Politica de expiração e retenção de convites:
 *
 * - broker_invitations: expiram em 72h
 * - invites (legado): expiram em 7 dias
 *
 * Regras de retenção:
 * - Convites PENDING expirados: status → EXPIRED, retidos por 90 dias
 * - Convites ACCEPTED/REVOKED/REPLACED: limpos após 90 dias
 * - Convites EXPIRED: limpos após 90 dias
 */

const EXPIRATION_THRESHOLD_HOURS = 72; // broker_invitations
const LEGACY_EXPIRATION_DAYS = 7; // invites
const RETENTION_DAYS = 90;

/**
 * Executa a varredura de expiração e limpeza de convites.
 * Pode ser chamado por cron job ou manualmente pelo super-admin.
 */
export async function sweepInvitations() {
  const db = getDatabase();
  const now = new Date();
  const results = {
    brokerExpired: 0,
    brokerCleaned: 0,
    legacyExpired: 0,
    legacyCleaned: 0,
    invitesExpired: 0,
    invitesCleaned: 0,
  };

  // 1. Expirar broker_invitations PENDING com prazo vencido
  const brokerExpired = await db
    .update(schema.brokerInvitations)
    .set({ status: "EXPIRED", revokedAt: now })
    .where(
      and(
        eq(schema.brokerInvitations.status, "PENDING"),
        lt(schema.brokerInvitations.expiresAt, now),
      ),
    )
    .returning({ id: schema.brokerInvitations.id });

  results.brokerExpired = brokerExpired.length;

  // 2. Limpar broker_invitations com status final e idade > RETENTION_DAYS
  const retentionCutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const brokerCleaned = await db
    .delete(schema.brokerInvitations)
    .where(
      and(
        sql`${schema.brokerInvitations.status} IN ('ACCEPTED', 'EXPIRED', 'REVOKED', 'REPLACED')`,
        lt(schema.brokerInvitations.createdAt, retentionCutoff),
      ),
    )
    .returning({ id: schema.brokerInvitations.id });

  results.brokerCleaned = brokerCleaned.length;

  // 3. Expirar invites (legado) PENDING com prazo vencido
  const legacyCutoff = new Date(now.getTime() - LEGACY_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
  // invites não têm campo de status - usamos usedAt e expiresAt
  const invitesExpired = await db
    .delete(schema.invites)
    .where(
      and(
        isNull(schema.invites.usedAt),
        lt(schema.invites.expiresAt, now),
        lt(schema.invites.createdAt, retentionCutoff),
      ),
    )
    .returning({ id: schema.invites.id });

  results.invitesExpired = invitesExpired.length;

  // 4. Limpar invites usados/expirados antigos
  const invitesCleaned = await db
    .delete(schema.invites)
    .where(
      and(
        lt(schema.invites.createdAt, retentionCutoff),
        sql`((${schema.invites.usedAt} IS NOT NULL) OR (${schema.invites.expiresAt} < ${now}))`,
      ),
    )
    .returning({ id: schema.invites.id });

  results.invitesCleaned = invitesCleaned.length;

  // Registrar auditoria
  const total = results.brokerExpired + results.brokerCleaned + results.invitesExpired + results.invitesCleaned;
  if (total > 0) {
    // Auditoria apenas via console - sem violação de FK
    console.log("[invite-sweep] Completed:", results);
  }

  return results;
}

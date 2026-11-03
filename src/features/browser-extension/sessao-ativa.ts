import "server-only";

import { gt, isNull, sql, type SQL } from "drizzle-orm";
import { schema } from "@/shared/db";

/** Ociosidade máxima: sem uso por 7 dias, a sessão deixa de valer. */
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60_000;
/** Teto absoluto: 30 dias desde a criação, mesmo com uso contínuo. Rotação não estende. */
export const SESSION_MAX_MS = 30 * 24 * 60 * 60_000;

export type SessaoParaCriterio = {
  revokedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  lastSeenAt: Date | null;
};

/**
 * Critério único de sessão ativa, usado pela autenticação das rotas e pela tela de conexão.
 * Não revogada, não vencida, dentro do teto de 30 dias e com uso nos últimos 7 dias
 * (lastSeenAt, ou createdAt quando nunca foi usada).
 */
export function sessaoAtivaEm(sessao: SessaoParaCriterio, agora: Date): boolean {
  return sessao.revokedAt === null
    && sessao.expiresAt > agora
    && agora.getTime() - sessao.createdAt.getTime() < SESSION_MAX_MS
    && agora.getTime() - (sessao.lastSeenAt ?? sessao.createdAt).getTime() < SESSION_IDLE_MS;
}

/**
 * Mesmo critério em SQL, para usar em consultas e atualizações. Não toca em lastSeenAt.
 * A data da ociosidade vai como texto ISO com CAST: Date cru num sql`` sem coluna quebra o driver.
 */
export function condicaoSessaoAtiva(agora: Date): SQL {
  const limiteOcioso = new Date(agora.getTime() - SESSION_IDLE_MS).toISOString();
  return sql`${isNull(schema.extensionSessions.revokedAt)} and ${gt(schema.extensionSessions.expiresAt, agora)} and ${gt(schema.extensionSessions.createdAt, new Date(agora.getTime() - SESSION_MAX_MS))} and coalesce(${schema.extensionSessions.lastSeenAt}, ${schema.extensionSessions.createdAt}) > CAST(${limiteOcioso} AS timestamptz)`;
}

import "server-only";

import { and, eq, gt, isNull, sql, type SQL } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { SESSION_IDLE_MS, SESSION_MAX_MS } from "./auth";

type SessaoLida = {
  userId: string;
  tenantId: string;
  revokedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  lastSeenAt: Date | null;
};

/**
 * Mesmo critério da autenticação da E0a (auth.ts): não revogada, não vencida, teto de 30 dias desde a criação
 * e ociosidade de 7 dias desde o último uso (lastSeenAt, ou createdAt quando nunca foi usada).
 */
export function sessaoAtivaEm(sessao: SessaoLida, agora: Date): boolean {
  return sessao.revokedAt === null
    && sessao.expiresAt > agora
    && agora.getTime() - sessao.createdAt.getTime() < SESSION_MAX_MS
    && agora.getTime() - (sessao.lastSeenAt ?? sessao.createdAt).getTime() < SESSION_IDLE_MS;
}

/** Versão SQL do mesmo critério. Só lê: não renova lastSeenAt. */
export function condicaoSessaoAtiva(userId: string, tenantId: string, agora: Date): SQL {
  return and(
    eq(schema.extensionSessions.userId, userId),
    eq(schema.extensionSessions.tenantId, tenantId),
    isNull(schema.extensionSessions.revokedAt),
    gt(schema.extensionSessions.expiresAt, agora),
    gt(schema.extensionSessions.createdAt, new Date(agora.getTime() - SESSION_MAX_MS)),
    sql`coalesce(${schema.extensionSessions.lastSeenAt}, ${schema.extensionSessions.createdAt}) > ${new Date(agora.getTime() - SESSION_IDLE_MS)}`,
  )!;
}

/** Há alguma sessão de extensão ativa deste usuário nesta empresa (critério da E0a). */
export async function sessaoExtensaoAtiva(userId: string, tenantId: string, agora = new Date()) {
  const [sessao] = await getDatabase()
    .select({ id: schema.extensionSessions.id })
    .from(schema.extensionSessions)
    .where(condicaoSessaoAtiva(userId, tenantId, agora))
    .limit(1);
  return Boolean(sessao);
}

/** Unidade do corretor dentro da própria empresa: nunca lê unidade de outro tenant. */
export function condicaoUnidade(tenantId: string, branchId: string): SQL {
  return and(eq(schema.branches.id, branchId), eq(schema.branches.tenantId, tenantId))!;
}

export async function unidadeDoCorretor(tenantId: string, branchId: string) {
  const [unidade] = await getDatabase()
    .select({ name: schema.branches.name })
    .from(schema.branches)
    .where(condicaoUnidade(tenantId, branchId))
    .limit(1);
  return unidade ?? null;
}

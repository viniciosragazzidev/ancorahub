import "server-only";

import { and, eq, type SQL } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { condicaoSessaoAtiva as criterioDeVida, sessaoAtivaEm } from "./sessao-ativa";

export { sessaoAtivaEm };

/** Sessão deste usuário nesta empresa que segue o critério único (sessao-ativa.ts). Só lê. */
export function condicaoSessaoAtiva(userId: string, tenantId: string, agora: Date): SQL {
  return and(
    eq(schema.extensionSessions.userId, userId),
    eq(schema.extensionSessions.tenantId, tenantId),
    criterioDeVida(agora),
  )!;
}

/** Há alguma sessão de extensão ativa deste usuário nesta empresa. */
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

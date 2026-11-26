import "server-only";

import { and, asc, eq, gte, inArray, type SQL } from "drizzle-orm";

import { dataSaoPaulo } from "@/features/whatsapp-autorreparo/decisao";
import { ACAO_AUDITORIA_START } from "@/features/whatsapp-autorreparo/vigia";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { classificarSituacao, ordenarLinhas, resultadoTentativa, type LinhaWhatsAppEquipe, type TentativaVigia } from "./situacao";

/**
 * Escopo dos corretores vistos: diretor, a empresa; gestor, a própria unidade; demais papéis, ninguém.
 * Devolve null quando o papel não vê a equipe.
 */
export function escopoCorretores(context: Pick<TenantContext, "role" | "branchId">): SQL | undefined | null {
  if (context.role === "director") return undefined;
  if (context.role === "manager" && context.branchId) return eq(schema.tenantMemberships.branchId, context.branchId);
  return null;
}

/**
 * Corretores ativos com a situação do WhatsApp pessoal (WAHA) e as tentativas do vigia hoje.
 * Fontes: `whatsapp_connections` (status, connected_at, updated_at) e os audit logs que o vigia grava
 * a cada start (`whatsapp.autorreparo.start`). O vigia não grava a queda em si: o histórico do dia
 * são as tentativas de reconexão.
 */
export async function getWhatsAppDaEquipe(context: TenantContext, agora = new Date()): Promise<LinhaWhatsAppEquipe[]> {
  const escopo = escopoCorretores(context);
  if (escopo === null) return [];
  const db = getDatabase();
  const linhas = await db
    .select({
      corretorId: schema.tenantMemberships.userId,
      nome: schema.user.name,
      unidade: schema.branches.name,
      conexaoId: schema.whatsappConnections.id,
      status: schema.whatsappConnections.status,
      connectedAt: schema.whatsappConnections.connectedAt,
      updatedAt: schema.whatsappConnections.updatedAt,
    })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .leftJoin(schema.branches, eq(schema.branches.id, schema.tenantMemberships.branchId))
    .leftJoin(schema.whatsappConnections, and(
      eq(schema.whatsappConnections.tenantId, context.tenantId),
      eq(schema.whatsappConnections.userId, schema.tenantMemberships.userId),
    ))
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId),
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.status, "active"),
      escopo,
    ));

  const conexaoIds = linhas.map((linha) => linha.conexaoId).filter((id): id is string => Boolean(id));
  const inicioDoDia = new Date(`${dataSaoPaulo(agora)}T00:00:00-03:00`);
  const tentativas = conexaoIds.length
    ? await db
      .select({ conexaoId: schema.auditLogs.entidadeId, em: schema.auditLogs.createdAt, metadata: schema.auditLogs.metadata })
      .from(schema.auditLogs)
      .where(and(
        eq(schema.auditLogs.entidade, "whatsapp_connection"),
        eq(schema.auditLogs.acao, ACAO_AUDITORIA_START),
        inArray(schema.auditLogs.entidadeId, conexaoIds),
        gte(schema.auditLogs.createdAt, inicioDoDia),
      ))
      .orderBy(asc(schema.auditLogs.createdAt))
    : [];
  const porConexao = new Map<string, TentativaVigia[]>();
  for (const tentativa of tentativas) {
    const lista = porConexao.get(tentativa.conexaoId) ?? [];
    lista.push({ em: new Date(tentativa.em).toISOString(), resultado: resultadoTentativa(tentativa.metadata) });
    porConexao.set(tentativa.conexaoId, lista);
  }

  // Um corretor tem no máximo uma conexão por empresa (índice único), mas a junção pode repetir em dado legado.
  const vistos = new Set<string>();
  const resultado: LinhaWhatsAppEquipe[] = [];
  for (const linha of linhas) {
    if (vistos.has(linha.corretorId)) continue;
    vistos.add(linha.corretorId);
    resultado.push({
      corretorId: linha.corretorId,
      nome: linha.nome,
      unidade: linha.unidade ?? null,
      situacao: classificarSituacao(linha.conexaoId ? { status: linha.status, connectedAt: linha.connectedAt } : null),
      desde: linha.updatedAt ? new Date(linha.updatedAt).toISOString() : null,
      tentativas: linha.conexaoId ? porConexao.get(linha.conexaoId) ?? [] : [],
    });
  }
  return ordenarLinhas(resultado);
}

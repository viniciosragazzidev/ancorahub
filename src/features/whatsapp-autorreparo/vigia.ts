import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, gte, isNotNull, ne, desc } from "drizzle-orm";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { dataSaoPaulo, decidirAcaoVigia } from "./decisao";
import { consultarStatusRelay, iniciarSessaoRelay } from "./relay";

export const ACAO_AUDITORIA_START = "whatsapp.autorreparo.start";
const LIMITE_CONEXOES_POR_EXECUCAO = 200;

export type ResumoVigia =
  | { ativo: false }
  | {
      ativo: true;
      startHabilitado: boolean;
      avaliadas: number;
      sincronizadas: number;
      tentativasStart: number;
      startsComErro: number;
      rotaStartAusente: boolean;
      semRespostaRelay: number;
      motivos: Record<string, number>;
    };

/**
 * Vigia de saúde das conexões de WhatsApp dos corretores (não-ready).
 * Consulta o relay (GET), sincroniza `ready` quando o relay diz CONNECTED e, com a flag de start,
 * tenta start em sessão que já conectou antes. Nunca chama recover nem delete.
 */
export async function runVigiaSaude(agora: Date = new Date()): Promise<ResumoVigia> {
  if ((await getFeatureFlag(FEATURE_FLAGS.WHATSAPP_AUTOREPARO)) !== "true") return { ativo: false };
  const startHabilitado = (await getFeatureFlag(FEATURE_FLAGS.WHATSAPP_AUTOREPARO_START)) === "true";

  const db = getDatabase();
  const conexoes = await db
    .select()
    .from(schema.whatsappConnections)
    .where(and(ne(schema.whatsappConnections.status, "ready"), isNotNull(schema.whatsappConnections.sessionName)))
    .limit(LIMITE_CONEXOES_POR_EXECUCAO);

  const inicioDoDia = new Date(`${dataSaoPaulo(agora)}T00:00:00-03:00`);
  const resumo = {
    ativo: true as const,
    startHabilitado,
    avaliadas: 0,
    sincronizadas: 0,
    tentativasStart: 0,
    startsComErro: 0,
    rotaStartAusente: false,
    semRespostaRelay: 0,
    motivos: {} as Record<string, number>,
  };
  const sistemaPorTenant = new Map<string, string>();

  for (const conexao of conexoes) {
    if (!conexao.sessionName) continue;
    resumo.avaliadas += 1;

    const relay = await consultarStatusRelay(conexao.sessionName);
    if (!relay.ok) {
      resumo.semRespostaRelay += 1;
      continue;
    }

    const tentativasHoje = await db
      .select({ criadoEm: schema.auditLogs.createdAt })
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.entidade, "whatsapp_connection"),
          eq(schema.auditLogs.entidadeId, conexao.id),
          eq(schema.auditLogs.acao, ACAO_AUDITORIA_START),
          gte(schema.auditLogs.createdAt, inicioDoDia),
        ),
      )
      .orderBy(desc(schema.auditLogs.createdAt));

    const acao = decidirAcaoVigia({
      statusCrm: conexao.status,
      statusRelay: relay.status,
      jaConectou: conexao.connectedAt !== null,
      startsHoje: tentativasHoje.length,
      ultimoStartEm: tentativasHoje[0]?.criadoEm ?? null,
      agora,
      startHabilitado,
    });
    const chave = acao.tipo === "aguardar" || acao.tipo === "nada" ? acao.motivo : acao.tipo;
    resumo.motivos[chave] = (resumo.motivos[chave] ?? 0) + 1;

    if (acao.tipo === "sincronizar") {
      await db
        .update(schema.whatsappConnections)
        .set({ status: acao.status, connectedAt: conexao.connectedAt ?? agora, updatedAt: agora })
        .where(and(eq(schema.whatsappConnections.id, conexao.id), ne(schema.whatsappConnections.status, "ready")));
      resumo.sincronizadas += 1;
      continue;
    }

    if (acao.tipo === "start") {
      const inicio = await iniciarSessaoRelay(conexao.sessionName);
      resumo.tentativasStart += 1;
      if (!inicio.ok) {
        resumo.startsComErro += 1;
        if (inicio.rotaAusente) resumo.rotaStartAusente = true;
      }
      // Toda tentativa conta para o limite diário e para o backoff, mesmo quando falha.
      let sistemaId = sistemaPorTenant.get(conexao.tenantId);
      if (!sistemaId) {
        sistemaId = await resolveSystemUserId(conexao.tenantId);
        sistemaPorTenant.set(conexao.tenantId, sistemaId);
      }
      await db.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: sistemaId,
        entidade: "whatsapp_connection",
        entidadeId: conexao.id,
        acao: ACAO_AUDITORIA_START,
        metadata: {
          sessao: conexao.sessionName,
          statusRelayAntes: relay.status,
          resultado: inicio.ok ? "ok" : "erro",
          erro: inicio.ok ? null : inicio.erro,
          tentativaDoDia: tentativasHoje.length + 1,
        },
      });
    }
  }

  return resumo;
}

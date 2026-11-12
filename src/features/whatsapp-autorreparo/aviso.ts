import "server-only";
import { randomUUID } from "node:crypto";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getDatabase, schema } from "@/shared/db";
import {
  avisoDeVesperaLiberado,
  chaveAvisoReconexao,
  dataPlantaoDeAmanha,
  horaAvisoValida,
} from "./decisao";
import { escaladosSemWhatsapp } from "./escala";
import { MENSAGEM_AVISO_RECONEXAO, TITULO_AVISO_RECONEXAO } from "./texto";

export const TIPO_AVISO_RECONEXAO = "whatsapp_reconexao";
export type ResumoAviso =
  | { ativo: false }
  | { ativo: true; antesDaHora: true; horaAviso: number }
  | {
      ativo: true;
      antesDaHora: false;
      horaAviso: number;
      dataPlantao: string;
      escalados: number;
      avisosNovos: number;
      jaAvisados: number;
    };

/**
 * Aviso de reconexão na véspera do plantão: a partir da hora configurada do dia anterior, cada
 * corretor escalado no dia seguinte sem WhatsApp `ready` recebe um aviso. Um aviso por corretor
 * por plantão (chave idempotente na tabela de notificações).
 */
export async function runAvisoVesperaReconexao(agora: Date = new Date()): Promise<ResumoAviso> {
  if ((await getFeatureFlag(FEATURE_FLAGS.WHATSAPP_AUTOREPARO)) !== "true") return { ativo: false };
  const horaAviso = horaAvisoValida(await getFeatureFlag(FEATURE_FLAGS.WHATSAPP_AUTOREPARO_AVISO_HORA));
  if (!avisoDeVesperaLiberado(agora, horaAviso)) return { ativo: true, antesDaHora: true, horaAviso };

  const dataPlantao = dataPlantaoDeAmanha(agora);
  const db = getDatabase();
  const tenants = await db
    .selectDistinct({ tenantId: schema.whatsappConnections.tenantId })
    .from(schema.whatsappConnections);

  let escalados = 0;
  let avisosNovos = 0;
  let jaAvisados = 0;

  for (const { tenantId } of tenants) {
    const corretores = await escaladosSemWhatsapp(tenantId, dataPlantao);
    escalados += corretores.length;
    for (const corretor of corretores) {
      const inseridos = await db
        .insert(schema.notifications)
        .values({
          id: randomUUID(),
          tenantId,
          recipientUserId: corretor.corretorId,
          type: TIPO_AVISO_RECONEXAO,
          title: TITULO_AVISO_RECONEXAO,
          message: MENSAGEM_AVISO_RECONEXAO,
          idempotencyKey: chaveAvisoReconexao(corretor.corretorId, dataPlantao),
        })
        .onConflictDoNothing()
        .returning({ id: schema.notifications.id });
      if (inseridos.length > 0) avisosNovos += 1;
      else jaAvisados += 1;
    }
  }

  return { ativo: true, antesDaHora: false, horaAviso, dataPlantao, escalados, avisosNovos, jaAvisados };
}

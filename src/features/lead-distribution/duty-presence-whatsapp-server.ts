import "server-only";

import { and, eq } from "drizzle-orm";

import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getWahaSessionLiveStatus } from "@/features/waha-cadence/relay-client";
import { normalizeWahaUiStatus } from "@/features/waha-cadence/status";
import { getDatabase, schema } from "@/shared/db";
import { logger } from "@/shared/infra/logger";

import { decideWhatsAppPresence, presenceRequiresWhatsApp, type WhatsAppPresenceCheck } from "./duty-presence-whatsapp";

/** A regra "presença exige WhatsApp" vale agora (flag e data). */
export async function isPresenceWhatsAppRequired(now = new Date()) {
  const flag = await getFeatureFlag(FEATURE_FLAGS.DUTY_PRESENCE_REQUIRES_WHATSAPP).catch(() => null);
  return presenceRequiresWhatsApp({ flag, now });
}

/** Status gravado do WhatsApp do corretor (sem ir ao serviço): para a tela saber o que mostrar. */
export async function getBrokerWhatsAppStoredStatus(tenantId: string, brokerId: string) {
  const [connection] = await getDatabase()
    .select({ sessionName: schema.whatsappConnections.sessionName, status: schema.whatsappConnections.status })
    .from(schema.whatsappConnections)
    .where(and(eq(schema.whatsappConnections.tenantId, tenantId), eq(schema.whatsappConnections.userId, brokerId)))
    .limit(1);
  return connection ?? null;
}

/**
 * O corretor pode confirmar presença? Confere o WhatsApp dele ao vivo. Se o serviço não responder,
 * libera e registra (decisão de 05/11).
 */
export async function checkBrokerWhatsAppForPresence(input: { tenantId: string; brokerId: string; now?: Date }): Promise<WhatsAppPresenceCheck> {
  const required = await isPresenceWhatsAppRequired(input.now);
  if (!required) return { allowed: true, reason: "not_required" };
  const connection = await getBrokerWhatsAppStoredStatus(input.tenantId, input.brokerId);
  let live: string | null | undefined = null;
  if (connection?.sessionName) {
    live = await getWahaSessionLiveStatus(connection.sessionName)
      .then((result) => normalizeWahaUiStatus(result.status ?? connection.status))
      .catch((error: unknown) => {
        logger.warn("[duty-presence] whatsapp_status_unavailable", { tenantId: input.tenantId, brokerId: input.brokerId, error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200) });
        return undefined;
      });
  }
  const decision = decideWhatsAppPresence({ required, hasSession: Boolean(connection?.sessionName), live });
  if (decision.allowed && decision.reason === "service_unavailable") {
    logger.warn("[duty-presence] confirmed_without_whatsapp_check", { tenantId: input.tenantId, brokerId: input.brokerId });
  }
  return decision;
}

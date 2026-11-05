"use server";

import { getWhatsAppConnection } from "@/app/(dashboard)/settings/whatsapp-actions";

import { isPresenceWhatsAppRequired } from "./duty-presence-whatsapp-server";

/**
 * Antes de confirmar presença (05/11): a regra vale agora e como está o WhatsApp do corretor.
 * Usa o status gravado (rápido); a confirmação no servidor confere ao vivo de novo.
 */
export async function getPresenceWhatsAppGateAction() {
  const required = await isPresenceWhatsAppRequired();
  if (!required) return { required: false as const };
  const connection = await getWhatsAppConnection();
  return { required: true as const, connected: connection.status === "ready", connection };
}

/**
 * Presença no plantão exige WhatsApp conectado (05/11, pedido do Vinicios): a partir de 06/11/2026
 * (horário de São Paulo), o corretor só confirma presença com a sessão do WhatsApp dele conectada.
 * Vale para online, presencial e plantão extra da noite. Desliga pela flag
 * `feature_duty_presence_requires_whatsapp`. Plano: docs/implementations/active/2026-11-05-presenca-exige-whatsapp.md
 */

/** Primeiro dia em que a regra vale (São Paulo). */
export const PRESENCE_WHATSAPP_REQUIRED_FROM = "2026-11-06";

export const PRESENCE_WHATSAPP_REQUIRED_CODE = "whatsapp_required";

export const PRESENCE_WHATSAPP_REQUIRED_MESSAGE = "Conecte o seu WhatsApp para confirmar presença no plantão.";

/** A regra vale neste momento: flag ligada e já é 06/11/2026 (ou depois) em São Paulo. */
export function presenceRequiresWhatsApp(input: { flag: string | null | undefined; now?: Date }): boolean {
  if (input.flag === "false") return false;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(input.now ?? new Date());
  return today >= PRESENCE_WHATSAPP_REQUIRED_FROM;
}

export type WhatsAppPresenceCheck = { allowed: true; reason: "not_required" | "connected" | "service_unavailable" } | { allowed: false };

/**
 * Decide com o status gravado e o status ao vivo. Ao vivo manda; se o serviço do WhatsApp não respondeu
 * (`live === undefined`), libera e quem chama registra no log: falha nossa não trava o plantão.
 */
export function decideWhatsAppPresence(input: { required: boolean; hasSession: boolean; live: string | null | undefined }): WhatsAppPresenceCheck {
  if (!input.required) return { allowed: true, reason: "not_required" };
  if (!input.hasSession) return { allowed: false };
  if (input.live === undefined) return { allowed: true, reason: "service_unavailable" };
  return input.live === "ready" ? { allowed: true, reason: "connected" } : { allowed: false };
}

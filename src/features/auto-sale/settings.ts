/**
 * Parâmetros editáveis da Venda Automatizada (AGENTS.md: auditável, editável, liga e desliga).
 * Setting por empresa `auto_sale_settings_<tenantId>` (JSON), editado no Super-admin com auditoria.
 * Puro: o leitor do servidor fica em `flag.ts`.
 */
import { z } from "zod";

import { AUTO_SALE_LIMITS, AUTO_SALE_SEND_END_HOUR, AUTO_SALE_SEND_START_HOUR } from "./contracts";

export const autoSaleSettingsSchema = z.object({
  burstWaitSeconds: z.number().int().min(10).max(300),
  messagesPerHour: z.number().int().min(1).max(20),
  messagesPerDay: z.number().int().min(1).max(60),
  sendStartHour: z.number().int().min(6).max(12),
  sendEndHour: z.number().int().min(17).max(22),
  audioPerDealPerDay: z.number().int().min(0).max(30),
  audioMaxSeconds: z.number().int().min(30).max(600),
  /** Horas sem ação do gestor (pausada ou aguardando) antes de devolver o lead à distribuição. */
  idleManagerHours: z.number().int().min(4).max(168),
  /** Cotação vai por link da página pública (com o PDF lá); desligado, vão imagens e o PDF no chat. */
  quoteLink: z.boolean(),
}).refine((value) => value.sendEndHour > value.sendStartHour, { message: "O fim do horário precisa ser depois do início.", path: ["sendEndHour"] });

export type AutoSaleSettings = z.infer<typeof autoSaleSettingsSchema>;

export const DEFAULT_AUTO_SALE_SETTINGS: AutoSaleSettings = {
  burstWaitSeconds: AUTO_SALE_LIMITS.burstWaitMs / 1000,
  messagesPerHour: AUTO_SALE_LIMITS.messagesPerHour,
  messagesPerDay: AUTO_SALE_LIMITS.messagesPerDay,
  sendStartHour: AUTO_SALE_SEND_START_HOUR,
  sendEndHour: AUTO_SALE_SEND_END_HOUR,
  audioPerDealPerDay: AUTO_SALE_LIMITS.audioPerDealPerDay,
  audioMaxSeconds: AUTO_SALE_LIMITS.audioMaxSeconds,
  idleManagerHours: 72,
  quoteLink: true,
};

/** Valor salvo inválido ou ausente cai no padrão do plano (nunca trava o robô). */
export function resolveAutoSaleSettings(raw: string | null | undefined): AutoSaleSettings {
  if (!raw) return DEFAULT_AUTO_SALE_SETTINGS;
  try {
    const parsed = autoSaleSettingsSchema.safeParse({ ...DEFAULT_AUTO_SALE_SETTINGS, ...JSON.parse(raw) });
    return parsed.success ? parsed.data : DEFAULT_AUTO_SALE_SETTINGS;
  } catch {
    return DEFAULT_AUTO_SALE_SETTINGS;
  }
}

import "server-only";

import {
  loadAiQualification,
  loadColdRecoveries,
  loadColdLeads,
  loadDuty,
  loadDutyShiftReminders,
  loadFirstContact,
  loadOffers,
  loadWaitingBroker,
  loadWhatsAppQueue,
} from "./loaders";
import type { LiveProvider, LiveStatusId } from "./types";

/**
 * Onda 1 do plano: os 8 status do "agora" da operação. Quem vê cada um mora em visibility.ts (função pura,
 * testada); aqui só a carga e a validade do cache compartilhado por escopo.
 */
export const LIVE_PROVIDERS: Record<LiveStatusId, LiveProvider> = {
  frios: { id: "frios", ttlMs: 30_000, load: loadColdLeads },
  "frios-recuperados": { id: "frios-recuperados", ttlMs: 60_000, load: loadColdRecoveries },
  "qualificacao-ia": { id: "qualificacao-ia", ttlMs: 20_000, load: loadAiQualification },
  "aguardando-corretor": { id: "aguardando-corretor", ttlMs: 20_000, load: loadWaitingBroker },
  ofertas: { id: "ofertas", ttlMs: 15_000, load: loadOffers },
  "primeiro-contato": { id: "primeiro-contato", ttlMs: 20_000, load: loadFirstContact },
  plantao: { id: "plantao", ttlMs: 30_000, load: loadDuty },
  "whatsapp-fila": { id: "whatsapp-fila", ttlMs: 20_000, load: loadWhatsAppQueue },
  "duty-reminders": { id: "duty-reminders", ttlMs: 60_000, load: loadDutyShiftReminders },
};

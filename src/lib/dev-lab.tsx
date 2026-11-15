"use client";

/**
 * Laboratório de fluxos (/dev/laboratorio, 15/11/2026): troca só a resposta do servidor por uma simulada, para
 * testar os fluxos reais (aceitar lead, confirmar presença) sem criar plantão nem mandar lead. Fora do
 * laboratório o contexto é null e os componentes seguem com as Server Actions e rotas de verdade.
 */
import { createContext, useContext } from "react";

export type DevLab = {
  /** No lugar de acceptLeadOfferAction. */
  acceptLead?: (leadId: string) => Promise<{ success: boolean; error?: string; whatsappUrl?: string }>;
  /** Depois do aceite simulado: no lugar de abrir o WhatsApp e ir para a ficha. */
  afterLeadAccepted?: (leadId: string, whatsappUrl: string | null) => void;
  /** No lugar do POST /api/duty/presence. */
  confirmPresence?: (assignmentId: string) => Promise<{ ok: boolean; error?: string; awaitingRelease?: boolean }>;
  /** No lugar da checagem do WhatsApp antes da presença. */
  presenceGate?: () => Promise<{ required: boolean; connected: boolean } | null>;
};

const DevLabContext = createContext<DevLab | null>(null);

export const DevLabProvider = DevLabContext.Provider;

export function useDevLab() {
  return useContext(DevLabContext);
}

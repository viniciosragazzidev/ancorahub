"use client";

/**
 * Laboratório de fluxos (/dev/laboratorio, 15/11/2026): troca só a resposta do servidor por uma simulada, para
 * testar os fluxos reais (aceitar lead, confirmar presença) sem criar plantão nem mandar lead. Fora do
 * laboratório o contexto é null e os componentes seguem com as Server Actions e rotas de verdade.
 */
import { createContext, useContext } from "react";

import type { SaleChatServices } from "@/features/post-sale/components/sale-chat";
import type { SasaActionResult, SasaClientCommand, SasaReply } from "@/features/sasa/command-core";
import type { ChatServerActionName } from "@/components/chat/types";
import type { VoiceTranscribe } from "@/components/chat/voice-recorder";
import type { TeamListApi } from "@/features/supervisor-workspace/lead-import/parse-contacts";

export type DevLab = {
  /** No lugar de acceptLeadOfferAction. */
  acceptLead?: (leadId: string) => Promise<{ success: boolean; error?: string; whatsappUrl?: string }>;
  /** Depois do aceite simulado: no lugar de abrir o WhatsApp e ir para a ficha. */
  afterLeadAccepted?: (leadId: string, whatsappUrl: string | null) => void;
  /** No lugar do POST /api/duty/presence. */
  confirmPresence?: (assignmentId: string) => Promise<{ ok: boolean; error?: string; awaitingRelease?: boolean }>;
  /** No lugar da checagem do WhatsApp antes da presença. */
  presenceGate?: () => Promise<{ required: boolean; connected: boolean } | null>;
  /** Lista interna da equipe do supervisor: no lugar das Server Actions de conferir, importar e distribuir. */
  teamList?: TeamListApi;
  /** Registrar venda em conversa: no lugar de ler o contrato e de registrar a venda. */
  sale?: SaleChatServices;
  /** Sasá agêntica: no lugar de sasaCommandAction e das ações do chat (Desfazer, atalhos de data). */
  sasa?: {
    command: (input: SasaClientCommand) => Promise<SasaReply>;
    run: (name: ChatServerActionName, payload: Record<string, string | number | boolean | null>) => Promise<SasaActionResult>;
    /** No lugar do POST /api/sasa/voz (fase 2): devolve um texto simulado. */
    transcribe?: VoiceTranscribe;
    /** Sem microfone (painel de testes): o botão grava de mentira, com o mesmo gesto. */
    simulateMic?: boolean;
    /** Chave "Sem internet" do laboratório (fase 3): o envio falha como sem rede e o áudio vai para a fila. */
    offline?: boolean;
    /** Perguntas sobre o ecossistema (19/11): no lugar de askAssistantAction. */
    ask?: (question: string) => Promise<import("@/components/chat/types").ChatBlock[]>;
    /** Fase 4: no lugar de navegar para a venda ou a cotação (o laboratório troca de fluxo). */
    open?: (open: import("@/features/sasa/drafts").SasaOpen) => void;
  };
};

const DevLabContext = createContext<DevLab | null>(null);

export const DevLabProvider = DevLabContext.Provider;

export function useDevLab() {
  return useContext(DevLabContext);
}

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
import type { QualificationLeadsServices } from "@/features/lead-journey/components/qualification-leads-workspace";

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
  /** Leads na qualificação (recuperação, fase 1): no lugar da linha do tempo e do "Não contatar". */
  qualificationLeads?: QualificationLeadsServices;
  /** Recuperação (fase 4): no lugar de mandar os segurados frios para a fila de ligação. */
  recoveryCallQueue?: { moveHeld: () => Promise<{ ok: true; moved: number } | { ok: false; error: string }> };
  /** Recuperação (fase 3): no lugar de salvar a configuração. */
  recoverySettings?: (settings: import("@/features/lead-recovery/settings-core").RecoverySettings) => Promise<{ ok: true; settings: import("@/features/lead-recovery/settings-core").RecoverySettings } | { ok: false; error: string }>;
  /** Sasá agêntico: no lugar de sasaCommandAction e das ações do chat (Desfazer, atalhos de data). */
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
    /** Voz do Sasá por ElevenLabs (teste de 23/11): conexão e fala simuladas. */
    voice?: import("@/features/sasa-voice/client").SasaVoiceBackend;
  };
  /** Registrar etapa na ficha do corretor (24/11, "Entrei em contato"): no lugar de changeLeadStatusAction. */
  leadStatus?: (formData: FormData) => Promise<import("@/app/(dashboard)/leads/status-actions").StatusChangeState>;
  /** Configurações > Meu telefone (23/11): no lugar de changeOwnPhoneAction. */
  phoneChange?: (phone: string) => Promise<import("@/features/broker-phone-change/actions").ChangeOwnPhoneState>;
  /** Formulário público (/formulario, 23/11): no lugar do POST /api/public/formulario. */
  publicForm?: { submit: (submission: import("@/features/public-form/form-flow").PublicFormSubmission) => Promise<import("@/features/public-form/form-flow").PublicFormResult> };
  /** Agente IA do diretor (21/11): conversa num mundo em memória (modelo com roteiro) e Desfazer simulado. */
  directorAgent?: {
    transport: import("ai").ChatTransport<import("ai").UIMessage>;
    undo: (actionId: string) => Promise<{ ok: boolean; message: string }>;
  };
};

const DevLabContext = createContext<DevLab | null>(null);

export const DevLabProvider = DevLabContext.Provider;

export function useDevLab() {
  return useContext(DevLabContext);
}

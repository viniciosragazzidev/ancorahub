/**
 * Catálogo central de feature flags e configurações do sistema.
 *
 * REGRA: toda chamada a getSystemSetting() DEVE passar por este catálogo.
 * Adicionar uma nova flag aqui antes de usá-la em qualquer outra parte do código.
 *
 * Escopo:
 * - "global"  → controlado pelo Super-admin. Afeta todos os tenants.
 * - "tenant"  → controlado pelo Diretor do tenant. Afeta apenas aquele tenant.
 */

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type FeatureFlagScope = "global" | "tenant";

export type FeatureFlagDefinition<T extends string = string> = {
  /** Chave usada na tabela system_settings */
  key: string;
  /** Escopo de controle */
  scope: FeatureFlagScope;
  /** Valor padrão quando a chave não existe no banco */
  defaultValue: T;
  /** Valores aceitos (se indefinido, aceita qualquer string) */
  allowedValues?: readonly T[];
  /** Descrição para exibição no painel do super-admin */
  description: string;
};

// ─── Feature Flags Globais (Super-admin) ─────────────────────────────────────

export const FEATURE_FLAGS = {
  // ── WhatsApp / WAHA ──────────────────────────────────────────────────────
  WAHA_CONNECTIONS: {
    key: "feature_waha_connections_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Habilita conexões WhatsApp via WAHA para todos os tenants.",
  },

  WAHA_CADENCE: {
    key: "feature_waha_cadence_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Habilita o motor de cadência de mensagens via WAHA.",
  },

  WAHA_AI: {
    key: "feature_waha_ai_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Habilita o agente de IA integrado ao WAHA.",
  },

  WAHA_INTERNAL_BROKER_NOTIFICATIONS: {
    key: "feature_waha_internal_broker_notifications_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Habilita o WAHA para avisos internos de distribuição destinados a corretores.",
  },

  MESSAGE_EVENT_POLICIES: {
    key: "feature_message_event_policies_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Habilita as políticas versionadas de mensagens por situação; desativar restaura os templates homologados legados.",
  },

  BROKER_ACCOUNT_ACTIVATION_NOTICE: {
    key: "feature_broker_account_activation_notice_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Envia ao membro a confirmação de conta ativa e o link de acesso após concluir o primeiro acesso.",
  },

  // ── IA / Qualificação ─────────────────────────────────────────────────────
  AI_ENABLED: {
    key: "ai_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Master switch da IA. Desabilitar desativa todos os agentes de IA.",
  },

  AI_WHATSAPP_QUALIFICATION: {
    key: "feature_ai_whatsapp_qualification_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Habilita o fluxo de qualificação via IA no WhatsApp.",
  },

  QUALIFICATION_ENGINE: {
    key: "feature_qualification_engine_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Habilita o motor de qualificação de leads.",
  },

  COLD_LEAD_REACTIVATION: {
    key: "feature_cold_lead_reactivation_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Habilita a reativação única de leads frios não distribuídos por WhatsApp oficial.",
  },

  AI_QUICK_REPLY: {
    key: "feature_ai_quick_reply_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Habilita respostas rápidas automáticas do agente de IA.",
  },

  AI_DEBOUNCE_DELAY_SECONDS: {
    key: "ai_debounce_delay_seconds",
    scope: "global",
    defaultValue: "0",
    description:
      "Segundos de debounce antes do agente processar uma mensagem. 0 = desabilitado. Máximo: 2 (limitado internamente).",
  },

  BROKER_AI_ASSISTANTS: {
    key: "feature_broker_ai_assistants_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Habilita a IA nos assistentes do app do corretor (texto livre e sugestões de ação). Plano: docs/implementations/active/2026-10-10-ia-assistentes-corretor.md.",
  },

  BROKER_ENGAGEMENT: {
    key: "feature_broker_engagement_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Liga a jornada do corretor: o coletor grava pontos por fatos do sistema (contato com mensagem enviada, aceite rápido, retorno em dia). Plano: docs/implementations/active/2026-10-10-central-relacionamento-corretor.md.",
  },

  RELATIONSHIP_CENTER: {
    key: "feature_relationship_center_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Liga a Central de relacionamento: direção envia avisos a corretores, unidades, plantões ou equipes e acompanha quem leu.",
  },

  CONVERSATION_INTELLIGENCE: {
    key: "feature_conversation_intelligence_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Habilita o motor de análise contínua de conversas e auto-feedback com IA.",
  },

  AI_MEMORY_RESET_MODE: {
    key: "ai_memory_reset_mode",
    scope: "global",
    defaultValue: "before_each_session",
    allowedValues: ["never", "before_each_session", "before_each_message"] as const,
    description:
      "Modo de reset de memória do agente. 'never' = memória persistente; 'before_each_session' = reset a cada sessão; 'before_each_message' = responde do zero a cada mensagem.",
  },

  AI_GROQ_API_KEY: {
    key: "ai_groq_api_key",
    scope: "global",
    defaultValue: "",
    description: "Chave de API Groq global. Sobreposta pela env GROQ_API_KEY.",
  },

  // ── Funcionalidades / Módulos ─────────────────────────────────────────────
  COMMERCIAL_WORKSPACE: {
    key: "feature_commercial_workspace_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Habilita o módulo de workspace comercial (Empresas).",
  },

  GLOBAL_SEARCH: {
    key: "feature_global_search_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Habilita a busca global na plataforma.",
  },

  BROWSER_EXTENSION: {
    key: "feature_browser_extension_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Habilita a extensão de navegador para captura de leads.",
  },

  UNLINKED_CONVERSATION_DELETION: {
    key: "feature_unlinked_conversation_deletion_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Permite que Diretores excluam qualquer histórico do WhatsApp e Gestores excluam somente conversas sem vínculo.",
  },

  CONVERSATION_MEDIA: {
    key: "feature_conversation_media_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description:
      "Habilita mídia oficial nas conversas (DEC-098): receber e enviar imagem, áudio, documento e vídeo pelo canal Meta, com armazenamento privado e acesso autenticado. Desativar interrompe novos downloads e envios sem apagar histórico.",
  },

  AGENT_TRAINING_CENTER: {
    key: "feature_agent_training_center_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Habilita o Centro de Treinamento do Agente de IA.",
  },

  CENTRAL_ATENCAO_STAGNANT_DAYS: {
    key: "feature_central_atencao_stagnant_days",
    scope: "global",
    defaultValue: "3",
    description:
      "Número de dias sem avanço de etapa para considerar um lead estagnado na Central de Atenção.",
  },

  BROKER_LITE_OPENING_DRAFT: {
    key: "broker_lite_opening_draft",
    scope: "global",
    defaultValue: "",
    description:
      "Rascunho de abertura padrão para o modo corretor lite no chat.",
  },

  REPORTING_CENTER: {
    key: "feature_reporting_center_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description:
      "Habilita as análises da Central de Relatórios, incluindo qualidade/origem dos leads e drill-down explicável. Desativa as análises; a visão operacional do Dashboard permanece disponível.",
  },

  BROKER_AVAILABILITY_ONBOARDING: {
    key: "feature_broker_availability_onboarding_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description:
      "Exige que corretores declarem sua agenda semanal e aplica essa agenda à distribuição automática de leads.",
  },

  DUTY_PRESENCE_CONFIRMATION: {
    key: "feature_duty_presence_confirmation_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Exige confirmação do corretor antes de torná-lo elegível aos leads do plantão vigente.",
  },
  ATTENDANCE_FLOWS: {
    key: "feature_attendance_flows_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Liga os fluxos de atendimento por fila (DEC-127). Desligado, toda fila segue o atendimento atual.",
  },

  DUTY_MONTHLY_SCHEDULING: {
    key: "feature_duty_monthly_scheduling_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Permite configurar cotas mensais, gerar propostas automáticas e publicar escalas de plantão.",
  },
  DUTY_INACTIVE_BROKERS: {
    key: "feature_duty_inactive_brokers_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Permite incluir cadastros desativados em escalas sem reativar acesso ou recebimento de leads.",
  },
  DUTY_OCCURRENCE_HISTORY: {
    key: "feature_duty_occurrence_history_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Mostra ocorrências encerradas e o histórico de leads distribuídos por plantão.",
  },
  BROKER_DUTY_CALENDAR: {
    key: "feature_broker_lite_duty_calendar_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Exibe a agenda de plantões próprios no Corretor Lite.",
  },
  BROKER_DUTY_CALENDAR_HORIZON_MONTHS: {
    key: "feature_broker_lite_duty_calendar_horizon_months",
    scope: "global",
    defaultValue: "3",
    allowedValues: ["1", "3", "6", "12"] as const,
    description: "Define por quantos meses a agenda de plantões do Corretor Lite exibe ocorrências futuras.",
  },
} as const satisfies Record<string, FeatureFlagDefinition<string>>;

// ─── Tipo utilitário ──────────────────────────────────────────────────────────

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS]["key"];

/** Retorna o valor padrão de uma flag pelo objeto de definição. */
export function getFeatureFlagDefault(flag: FeatureFlagDefinition): string {
  return flag.defaultValue;
}

/**
 * Verifica se uma string é uma feature flag key conhecida.
 * Útil para validação no super-admin.
 */
export function isKnownFeatureFlagKey(key: string): key is FeatureFlagKey {
  return Object.values(FEATURE_FLAGS).some((flag) => flag.key === key);
}

/**
 * Retorna todas as definições de flags de um determinado escopo.
 */
export function getFlagsByScope(scope: FeatureFlagScope): FeatureFlagDefinition[] {
  return Object.values(FEATURE_FLAGS).filter((flag) => flag.scope === scope);
}

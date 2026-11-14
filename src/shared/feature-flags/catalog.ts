/**
 * Catálogo central de feature flags e configurações do sistema.
 *
 * REGRA: toda chamada a getSystemSetting() DEVE passar por este catálogo.
 * Adicionar uma nova flag aqui antes de usá-la em qualquer outra parte do código.
 *
 * Escopo:
 * - "global"  → controlado pelo Super-admin. Afeta todos os tenants.
 * - "tenant"  → valor isolado por empresa; a autoridade de controle é definida pela capacidade.
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
  ERP_OPERATIONAL: {
    key: "feature_erp_operational_enabled", scope: "global", defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Habilita o ERP operacional. Cada módulo exige liberação global e ativação na empresa; desligar preserva dados e bloqueia novas operações.",
  },
  ERP_MODULES: {
    key: "feature_erp_operational_modules", scope: "global", defaultValue: "[]",
    description: "Módulos ERP liberados pelo Super-admin. Lista validada e auditada no painel ERP.",
  },
  BROKER_NOW_FLOATING: {
    key: "feature_broker_now_floating_enabled", scope: "global", defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Agora do corretor em painel flutuante no Lite. Desativar restaura o bloco inline, preservando dados e ações.",
  },
  BROKER_HOME_V2: {
    key: "feature_broker_home_v2",
    scope: "tenant",
    defaultValue: '{"enabled":false,"brokerIds":[],"showLearning":true}',
    description: "Piloto da nova Home do corretor, por empresa e corretores explícitos; editável e reversível pelo Super-admin.",
  },
  UI_CONTEXTUAL_ILLUSTRATIONS: {
    key: "feature_ui_contextual_illustrations",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Mostra ilustrações contextuais no Diretor Lite e Corretor Lite. Desligar restaura os ícones e estados anteriores.",
  },
  WHATSAPP_PLANTAO_NOTICE: {
    key: "feature_whatsapp_plantao_notice_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Mostra aos corretores sem WhatsApp conectado o aviso sobre os leads do plantão a partir de 20/10.",
  },
  WHATSAPP_AUTOREPARO: {
    key: "feature_whatsapp_autoreparo_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Auto-reparo das conexões WhatsApp dos corretores: sincroniza o status pelo relay e envia o aviso de reconexão na véspera do plantão. Padrão desligado.",
  },
  WHATSAPP_AUTOREPARO_START: {
    key: "feature_whatsapp_autoreparo_start_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Permite ao vigia reiniciar (start) sessões que já conectaram e estão em erro. Nunca apaga sessão. Exige a rota de start no relay. Padrão desligado.",
  },
  WHATSAPP_AUTOREPARO_AVISO_HORA: {
    key: "feature_whatsapp_autoreparo_aviso_hora",
    scope: "global",
    defaultValue: "18",
    description: "Hora (0 a 23, horário de São Paulo) do aviso de reconexão na véspera do plantão. Valor a confirmar com o Vinicios.",
  },
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

  WAHA_GROUP_CAPTURE: {
    key: "feature_waha_group_capture_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Lê os grupos de operadoras escolhidos no número de materiais e publica PDFs e imagens como material de cotação.",
  },

  OPERATOR_MATERIAL_TTL_DAYS: {
    key: "operator_material_ttl_days",
    scope: "global",
    defaultValue: "45",
    description: "Dias de validade de uma tabela de operadora que não informa o fim da vigência. 0 desliga a expiração.",
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

  WELCOME_VIDEO: {
    key: "feature_welcome_video_enabled", scope: "global", defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Mostra o vídeo de boas-vindas (1 min) no primeiro acesso do corretor ao app Lite.",
  },
  BROKER_NAV_REORG: {
    key: "feature_broker_navigation_reorg_enabled", scope: "global", defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Modo corretor reorganizado (plano do modo corretor): Início sem Dicas de Atendimento e Jornada, com Minha carteira entre os acessos (etapa 1); Desempenho em período, resultados, atendimento e conversão, metas e Minha jornada (etapa 2); Plantões em uma entrada única (etapa 3); Minha carteira com visões e Novo interessado, junto com a carteira Lite (etapa 4a); Perfil do cliente com histórico (etapa 5); Agenda agrupada por dia ligada a leads e perfis (etapa 6). Desligada, volta tudo ao anterior.",
  },
  BROKER_JOURNEY: {
    key: "feature_broker_journey_enabled", scope: "global", defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Habilita missões, conquistas, níveis e celebrações da jornada do corretor.",
  },
  TEAM_RANKING: {
    key: "feature_team_ranking_enabled", scope: "global", defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Habilita o placar semanal da unidade e das equipes, com opção de privacidade.",
  },
  ENGAGEMENT_CAMPAIGNS: {
    key: "feature_engagement_campaigns_enabled", scope: "global", defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Habilita missões de campanha configuradas pelo gestor.",
  },

  SUPERVISOR_LITE: {
    key: "feature_supervisor_lite_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Modo Lite do supervisor (S2): Início em conversas com Equipe, Leads da equipe e Desempenho da equipe. Só vale com o escopo da equipe ligado.",
  },
  MANAGER_LITE: {
    key: "feature_manager_lite_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Força o Gestor a usar a experiência Lite, começando por Leads.",
  },
  DIRECTOR_LITE_STYLE: {
    key: "feature_director_lite_style",
    scope: "tenant",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Habilita o visual Lite somente para o Diretor desta empresa. O Super-admin controla cada piloto.",
  },
  BROKER_AD_CONTEXT: {
    key: "feature_broker_ad_context",
    scope: "tenant",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Mostra ao corretor o cartão \"De onde veio\": o plano anunciado pela campanha e o título, o texto e a imagem do anúncio. Nunca o nome da campanha, IDs ou verba. O Super-admin liga por empresa; a chave real é feature_broker_ad_context_<tenantId>.",
  },
  LIVE_STATUS_STRIP: {
    key: "feature_live_status_strip",
    scope: "tenant",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Mostra a faixa \"Agora na operação\" (status vivos) no Painel e na Distribuição desta empresa. O Super-admin liga por empresa; a chave real é feature_live_status_strip_<tenantId>.",
  },
  LITE_ACCEPT_HANDOFF: {
    key: "feature_lite_accept_handoff",
    scope: "tenant",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Aceite com contador no Lite: ao aceitar o lead, o corretor vê as informações dele e o WhatsApp abre sozinho em 30 s (ou na hora, tocando no botão). A chave real é feature_lite_accept_handoff_<tenantId>.",
  },
  CUSTOMER_WAITING_GUARD: {
    key: "feature_customer_waiting_guard",
    scope: "tenant",
    defaultValue: "off",
    allowedValues: ["off", "observe"] as const,
    description: "Cliente aguardando o corretor: em \"observe\" registra no histórico do lead o que faria (IA acolhe, cobranças, troca de corretor) sem enviar nada e mostra a espera na Negociações. O Super-admin liga por empresa; a chave real é feature_customer_waiting_guard_<tenantId>.",
  },
  AI_AUDIO_TRANSCRIPTION: {
    key: "feature_ai_audio_transcription",
    scope: "tenant",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "A IA de qualificação ouve (transcreve) os 2 primeiros áudios de cada lead em qualificação, até 2 minutos. O Super-admin liga por empresa; a chave real é feature_ai_audio_transcription_<tenantId>.",
  },
  AUTO_SALE: {
    key: "feature_auto_sale",
    scope: "tenant",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Venda Automatizada (piloto, DEC-182): a IA conduz a venda de um lead quente por vez, escolhido pelo gestor, em Simulação ou Copiloto. Nunca passa o lead a um corretor sozinha. Inclui a transcrição de áudio na negociação. O Super-admin liga por empresa; a chave real é feature_auto_sale_<tenantId>.",
  },
  AUTO_SALE_AUTOPILOT: {
    key: "feature_auto_sale_autopilot",
    scope: "tenant",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Libera o modo Autopiloto da Venda Automatizada (a IA envia sozinha, com limites, só planos revisados). O gestor ainda escolhe o modo por negociação. A chave real é feature_auto_sale_autopilot_<tenantId>.",
  },
  AUTO_SALE_GLOBAL: {
    key: "feature_auto_sale_global_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Kill switch da Venda Automatizada para todas as empresas. Desligado, o robô não responde nem envia e as negociações ficam pausadas pela plataforma.",
  },
  DUTY_SHIFT_REMINDER_24H: {
    key: "feature_duty_reminder_24h",
    scope: "tenant",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Envia pelo WhatsApp corporativo um lembrete 24 h antes do plantão. O Super-admin liga por empresa; desligado por padrão.",
  },
  TEAM_MANAGEMENT: {
    key: "feature_team_management_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Habilita a camada de métricas da Gestão de Equipes para gestor e supervisor.",
  },
  BROKER_PERFORMANCE_LITE: {
    key: "feature_broker_performance_lite_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Mostra ao corretor Lite o painel de Desempenho com os próprios números, funil, meta e vendas por operadora.",
  },
  BROKER_SELF_UNIT_CHANGE: {
    key: "feature_broker_self_unit_change_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Permite ao corretor trocar a própria unidade em Configurações, entre unidades ativas da mesma empresa, com auditoria e aviso à gestão (DEC-171).",
  },

  SUPERVISOR_TEAM_SCOPE: {
    key: "feature_supervisor_team_scope_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Supervisor vê só os leads e a equipe dos corretores que ele supervisiona (S1 do Lite do supervisor). Desligado, segue vendo a unidade.",
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
    description: "Habilita a extensão contextual do WhatsApp Web junto com os gates de tenant e piloto.",
  },

  POST_SALE_AUDIT: {
    key: "feature_post_sale_audit_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Habilita campanhas de auditoria do atendimento pós-venda por WhatsApp.",
  },

  BROWSER_EXTENSION_PILOT_USERS: {
    key: "feature_browser_extension_pilot_users",
    scope: "global",
    defaultValue: "",
    description: "Usuários autorizados no piloto da extensão de navegador.",
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
  PLANTAO_REPORT: {
    key: "feature_plantao_report_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Interruptor global do relatório diário de resultado do plantão enviado ao WhatsApp.",
  },

  NEGOTIATIONS_AREA: {
    key: "feature_negotiations_area_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description:
      "Libera a área de acompanhamento de negociações para diretor, gestor e supervisor, respeitando unidade e equipe.",
  },
  LEAD_COMMERCIAL_VALUES: {
    key: "feature_lead_commercial_values_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description:
      "Habilita o valor mensal e as vidas no funil de leads, a edição na ficha e as cotações vinculadas. O Super-admin pode desligar a experiência sem apagar os dados.",
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
  STALE_STAGE_RULE: {
    key: "feature_stale_stage_rule_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Regra de chat parado (05/11): lead em cotação, negociação ou fechamento com o cliente 5 dias úteis sem responder vai para Aguardando retorno, e depois de mais 10 para Perdido (sem contato); volta sozinho se o cliente responder. Cada empresa começa em simulação. Desligar para tudo.",
  },
  DUTY_PRESENCE_REQUIRES_WHATSAPP: {
    key: "feature_duty_presence_requires_whatsapp",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "A partir de 06/11/2026, o corretor só confirma presença no plantão com o WhatsApp dele conectado; sem conexão, o app abre a conexão por código e confirma ao conectar.",
  },
  LEAD_BROKER_INTRO: {
    key: "feature_lead_broker_intro_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Quando o corretor aceita o lead, o lead recebe no número oficial o nome e o número do corretor, com uma mensagem de boas-vindas. Texto livre só dentro da janela de 24 h; fora dela, só com modelo aprovado da Meta configurado no evento.",
  },
  DUTY_ROTATION: {
    key: "feature_duty_rotation_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Rodízio no plantão: cada corretor tem sua vez, na ordem em que confirmou presença; quem chega depois entra no fim. Oferta expirada ou recusada gasta a vez e conta como pulo; no 3º pulo o corretor é pausado e o supervisor avisado. Desligado, volta o nivelamento por leads recebidos.",
  },
  DUTY_START_OFFER_INTERVAL: {
    key: "feature_duty_start_offer_interval_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Intervalo de início de plantão: na primeira hora, enquanto há escalados por confirmar presença e só 1 a 3 confirmaram, cada confirmado recebe no máximo um lead a cada 8 minutos. Lead quente não espera. Exceção à DEC-151.",
  },
  HOT_LEAD_EARLY_DISTRIBUTION: {
    key: "feature_hot_lead_early_distribution_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Lead de alta aptidão sai para o corretor no momento em que a IA o marca, sem esperar o fim da qualificação (DEC-153).",
  },
  PLANTAO_PRIORITY: {
    key: "feature_plantao_priority_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Prioridade leve por tipo de plantão (ex.: Premium) na distribuição de leads quentes e mornos. Desligada, a distribuição é idêntica à anterior; ligada, cada empresa escolhe off/sombra/on na política de distribuição.",
  },
  DUTY_OVERNIGHT_EXTRA_SHIFT: {
    key: "feature_duty_overnight_extra_shift_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Plantão extra dos leads da noite (DEC-152): os leads das 19h às 8h vão, a partir do horário do extra, para os escalados da manhã da fila que confirmarem o link.",
  },
  DUTY_OVERNIGHT_EXTRA_STARTS_AT: {
    key: "duty_overnight_extra_shift_starts_at",
    scope: "global",
    defaultValue: "07:00",
    allowedValues: ["06:00", "06:30", "07:00", "07:30", "08:00"] as const,
    description: "Horário em que o plantão extra dos leads da noite começa e o link é enviado.",
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
    description: "Permite planejar corretores desativados e convidados pendentes em escalas. Convidados só entram na operação depois de aceitar e criar acesso; a configuração não reativa contas.",
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
  BROKER_CLIENT_WALLET_LITE: {
    key: "feature_broker_client_wallet_lite_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Habilita a carteira avançada e os retornos de clientes do Corretor Lite.",
  },
  BROKER_PRIOR_CLIENTS: {
    key: "feature_broker_prior_clients_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Cliente que já possuo (DEC-187, etapa 4b do modo corretor): o corretor cadastra na Minha carteira clientes e contratos anteriores ao CRM, sem venda, comissão, conversão ou pontos. Só vale com o Início reorganizado e a carteira Lite ligados.",
  },
  BROKER_SALE_REGISTRATION_V2: {
    key: "feature_broker_sale_registration_v2_enabled",
    scope: "global",
    defaultValue: "false",
    allowedValues: ["true", "false"] as const,
    description: "Habilita o novo fluxo Lite de registro de venda para corretores.",
  },
  BROKER_QUICK_SALE: {
    key: "feature_broker_quick_sale_enabled",
    scope: "global",
    defaultValue: "true",
    allowedValues: ["true", "false"] as const,
    description: "Registrar venda em dois toques (plano Início do corretor e CRM, parte B): em Minha carteira o corretor escolhe um lead em negociação e a tela do lead abre o registro de venda (`/leads/[id]?registrar-venda=1`). Nenhuma regra de venda muda. Desligada, some o acesso e o parâmetro é ignorado.",
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

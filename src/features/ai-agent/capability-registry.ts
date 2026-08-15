export type AgentRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AgentExecutionScope =
  | "MESSAGE"
  | "CONVERSATION"
  | "QUALIFICATION_SESSION"
  | "LEAD"
  | "CONTACT"
  | "TENANT";

export type AgentRepeatPolicy =
  | "ONCE"
  | "ONCE_PER_CONVERSATION"
  | "ONCE_PER_SESSION"
  | "UNTIL_VALID"
  | "REPEATABLE"
  | "COOLDOWN"
  | "MANUAL_ONLY";

export type QualificationFactStatus =
  | "PENDING"
  | "COLLECTED"
  | "VALIDATED"
  | "CONFIRMED"
  | "CORRECTED"
  | "INVALID";

export interface QualificationFact {
  key: string;
  value: string;
  status: QualificationFactStatus;
  sourceMessageId?: string;
  updatedAt: string;
}

export interface AgentCapabilityDefinition {
  key: string;
  name: string;
  description: string;
  category: "intake" | "conversation" | "crm" | "qualification" | "whatsapp" | "automation";
  riskLevel: AgentRiskLevel;
  executionScope: AgentExecutionScope;
  repeatPolicy: AgentRepeatPolicy;
  keywords: string[];
  allowedConversationStates: string[];
  requiredPermissions: string[];
  requiredFacts: string[];
  producedFacts: string[];
  preconditions: string[];
  postconditions: string[];
  idempotencyStrategy: string;
  canRunWhenHumanActive: boolean;
  canRunAfterOptOut: boolean;
  enabled: boolean;
  version: number;
}

export const AGENT_CAPABILITIES: AgentCapabilityDefinition[] = [
  // --- INTAKE & FACTS COLLECTION CAPABILITIES ---
  {
    key: "COLLECT_NAME",
    name: "Coletar / Confirmar Nome",
    description: "Solicita e valida o nome completo ou preferencial do lead.",
    category: "intake",
    riskLevel: "LOW",
    executionScope: "QUALIFICATION_SESSION",
    repeatPolicy: "UNTIL_VALID",
    keywords: ["qual seu nome", "meu nome e", "me chamo"],
    allowedConversationStates: ["AI_ACTIVE", "WAITING_CUSTOMER"],
    requiredPermissions: ["acessar_qualificacao_ia"],
    requiredFacts: [],
    producedFacts: ["name"],
    preconditions: ["lead_exists"],
    postconditions: ["fact_name_collected_or_updated"],
    idempotencyStrategy: "qualification:{sessionId}:fact:name",
    canRunWhenHumanActive: false,
    canRunAfterOptOut: false,
    enabled: true,
    version: 1,
  },
  {
    key: "COLLECT_DEPENDENTS",
    name: "Coletar Vidas & Dependentes",
    description: "Pergunta e valida a quantidade de beneficiários ou vidas para o plano.",
    category: "intake",
    riskLevel: "LOW",
    executionScope: "QUALIFICATION_SESSION",
    repeatPolicy: "UNTIL_VALID",
    keywords: ["quantas vidas", "dependentes", "quantas pessoas", "familia"],
    allowedConversationStates: ["AI_ACTIVE", "WAITING_CUSTOMER"],
    requiredPermissions: ["acessar_qualificacao_ia"],
    requiredFacts: [],
    producedFacts: ["dependents"],
    preconditions: ["lead_exists"],
    postconditions: ["fact_dependents_collected_or_updated"],
    idempotencyStrategy: "qualification:{sessionId}:fact:dependents",
    canRunWhenHumanActive: false,
    canRunAfterOptOut: false,
    enabled: true,
    version: 1,
  },
  {
    key: "COLLECT_CITY",
    name: "Coletar Cidade / Região",
    description: "Coleta a cidade e estado para mapeamento de rede credenciada.",
    category: "intake",
    riskLevel: "LOW",
    executionScope: "QUALIFICATION_SESSION",
    repeatPolicy: "UNTIL_VALID",
    keywords: ["qual cidade", "moro em", "regiao", "sao paulo", "rio de janeiro"],
    allowedConversationStates: ["AI_ACTIVE", "WAITING_CUSTOMER"],
    requiredPermissions: ["acessar_qualificacao_ia"],
    requiredFacts: [],
    producedFacts: ["city"],
    preconditions: ["lead_exists"],
    postconditions: ["fact_city_collected_or_updated"],
    idempotencyStrategy: "qualification:{sessionId}:fact:city",
    canRunWhenHumanActive: false,
    canRunAfterOptOut: false,
    enabled: true,
    version: 1,
  },
  {
    key: "COLLECT_PLAN_TYPE",
    name: "Coletar Tipo de Plano",
    description: "Pergunta se a cotação é para Pessoa Física (Individual/Familiar) ou Jurídica (PME/CNPJ).",
    category: "intake",
    riskLevel: "LOW",
    executionScope: "QUALIFICATION_SESSION",
    repeatPolicy: "UNTIL_VALID",
    keywords: ["tipo de plano", "cnpj", "individual", "familiar", "pme"],
    allowedConversationStates: ["AI_ACTIVE", "WAITING_CUSTOMER"],
    requiredPermissions: ["acessar_qualificacao_ia"],
    requiredFacts: [],
    producedFacts: ["planType"],
    preconditions: ["lead_exists"],
    postconditions: ["fact_planType_collected_or_updated"],
    idempotencyStrategy: "qualification:{sessionId}:fact:planType",
    canRunWhenHumanActive: false,
    canRunAfterOptOut: false,
    enabled: true,
    version: 1,
  },

  // --- CONVERSATION & HANDOFF CAPABILITIES ---
  {
    key: "TRANSFER_TO_HUMAN",
    name: "Transferir para Humano",
    description: "Pausa o atendimento virtual e transfere o lead para a equipe humana.",
    category: "conversation",
    riskLevel: "HIGH",
    executionScope: "CONVERSATION",
    repeatPolicy: "ONCE_PER_CONVERSATION",
    keywords: ["falar com atendente", "corretor", "humano", "falar com pessoa", "urgente"],
    allowedConversationStates: ["AI_ACTIVE", "WAITING_CUSTOMER"],
    requiredPermissions: ["acessar_conversas"],
    requiredFacts: [],
    producedFacts: ["human_transfer_requested"],
    preconditions: ["conversation_owner_is_ai"],
    postconditions: ["conversation_owner_is_human", "lead_status_waiting_human"],
    idempotencyStrategy: "conversation:{conversationId}:transfer_human",
    canRunWhenHumanActive: false,
    canRunAfterOptOut: false,
    enabled: true,
    version: 1,
  },
  {
    key: "MARK_OPT_OUT",
    name: "Registrar Recusa (Opt-Out)",
    description: "Interrompe o atendimento virtual e suprime comunicações futuras para o contato.",
    category: "conversation",
    riskLevel: "HIGH",
    executionScope: "CONTACT",
    repeatPolicy: "ONCE",
    keywords: ["nao tenho interesse", "nao quero", "sem interesse", "cancelar", "descadastrar"],
    allowedConversationStates: ["AI_ACTIVE", "WAITING_CUSTOMER", "WAITING_HUMAN", "HUMAN_ACTIVE"],
    requiredPermissions: ["acessar_conversas"],
    requiredFacts: [],
    producedFacts: ["contact.optedOut"],
    preconditions: ["contact_exists"],
    postconditions: ["future_communications_suppressed", "lead_status_closed_cold"],
    idempotencyStrategy: "contact:{contactId}:opt_out",
    canRunWhenHumanActive: true,
    canRunAfterOptOut: false,
    enabled: true,
    version: 1,
  },
  {
    key: "MARK_WRONG_NUMBER",
    name: "Registrar Número Errado / Engano",
    description: "Marca o número como desacreditado/engano e fecha o atendimento virtual.",
    category: "conversation",
    riskLevel: "HIGH",
    executionScope: "CONTACT",
    repeatPolicy: "ONCE",
    keywords: ["nao sou", "numero errado", "engano", "pessoa errada", "nao conheco"],
    allowedConversationStates: ["AI_ACTIVE", "WAITING_CUSTOMER"],
    requiredPermissions: ["acessar_conversas"],
    requiredFacts: [],
    producedFacts: ["contact.wrongNumber"],
    preconditions: ["contact_exists"],
    postconditions: ["lead_status_disqualified"],
    idempotencyStrategy: "contact:{contactId}:wrong_number",
    canRunWhenHumanActive: false,
    canRunAfterOptOut: false,
    enabled: true,
    version: 1,
  },

  // --- QUALIFICATION & DISTRIBUTION CAPABILITIES ---
  {
    key: "COMPLETE_QUALIFICATION",
    name: "Finalizar Qualificação",
    description: "Calcula a classificação do lead (Hot, Warm, Cold) e gera o resultado estruturado.",
    category: "qualification",
    riskLevel: "HIGH",
    executionScope: "QUALIFICATION_SESSION",
    repeatPolicy: "ONCE_PER_SESSION",
    keywords: ["qualificacao concluida", "finalizar atendimento"],
    allowedConversationStates: ["AI_ACTIVE", "WAITING_CUSTOMER"],
    requiredPermissions: ["acessar_qualificacao_ia"],
    requiredFacts: ["name", "city", "planType"],
    producedFacts: ["qualification.result"],
    preconditions: ["required_facts_confirmed"],
    postconditions: ["qualification_status_completed"],
    idempotencyStrategy: "qualification:{sessionId}:complete",
    canRunWhenHumanActive: false,
    canRunAfterOptOut: false,
    enabled: true,
    version: 1,
  },
  {
    key: "REQUEST_DISTRIBUTION",
    name: "Solicitar Distribuição do Lead",
    description: "Encaminha o lead qualificado para a Fila de Distribuição para atrelamento de corretor.",
    category: "qualification",
    riskLevel: "HIGH",
    executionScope: "LEAD",
    repeatPolicy: "ONCE",
    keywords: ["distribuir lead", "enviar para fila"],
    allowedConversationStates: ["AI_ACTIVE", "WAITING_CUSTOMER", "WAITING_HUMAN", "CLOSED"],
    requiredPermissions: ["acessar_leads"],
    requiredFacts: [],
    producedFacts: ["lead.distributed"],
    preconditions: ["lead_qualification_completed_or_interrupted"],
    postconditions: ["lead_in_distribution_queue_or_assigned"],
    idempotencyStrategy: "lead:{leadId}:initial_distribution",
    canRunWhenHumanActive: true,
    canRunAfterOptOut: false,
    enabled: true,
    version: 1,
  },

  // --- CRM & TAGGING CAPABILITIES ---
  {
    key: "ADD_LEAD_TAG",
    name: "Adicionar Tag Interna no Lead",
    description: "Adiciona uma etiqueta de classificação ao perfil do lead sem duplicidades.",
    category: "crm",
    riskLevel: "MEDIUM",
    executionScope: "LEAD",
    repeatPolicy: "REPEATABLE",
    keywords: ["adicionar tag", "etiquetar"],
    allowedConversationStates: ["AI_ACTIVE", "WAITING_CUSTOMER", "WAITING_HUMAN", "HUMAN_ACTIVE", "CLOSED"],
    requiredPermissions: ["acessar_leads"],
    requiredFacts: [],
    producedFacts: ["tag_added"],
    preconditions: ["lead_exists"],
    postconditions: ["lead_tag_persisted"],
    idempotencyStrategy: "lead:{leadId}:tag:{tagName}",
    canRunWhenHumanActive: true,
    canRunAfterOptOut: true,
    enabled: true,
    version: 1,
  },

  // --- AUTOMATION & WEBHOOK CAPABILITIES ---
  {
    key: "WEBHOOK_AUTOMATION",
    name: "Disparar Webhook Externa",
    description: "Envia os dados do lead para um endpoint de integração aprovado.",
    category: "automation",
    riskLevel: "CRITICAL",
    executionScope: "TENANT",
    repeatPolicy: "COOLDOWN",
    keywords: ["webhook", "automacao externa"],
    allowedConversationStates: ["AI_ACTIVE", "WAITING_CUSTOMER", "WAITING_HUMAN", "CLOSED"],
    requiredPermissions: ["acessar_configuracoes"],
    requiredFacts: [],
    producedFacts: ["webhook_dispatched"],
    preconditions: ["approved_webhook_url_configured"],
    postconditions: ["webhook_event_logged"],
    idempotencyStrategy: "webhook:{eventId}:{leadId}",
    canRunWhenHumanActive: true,
    canRunAfterOptOut: false,
    enabled: true,
    version: 1,
  },
];

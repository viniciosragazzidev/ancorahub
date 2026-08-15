export type AgentTriggerCategory = "intake" | "action";

export type AgentTriggerActionType =
  | "COLLECT_NAME"
  | "COLLECT_DEPENDENTS"
  | "COLLECT_CITY"
  | "COLLECT_PLAN_TYPE"
  | "COLLECT_URGENCY"
  | "TRANSFER_HUMAN"
  | "TAG_HOT"
  | "TAG_WARM"
  | "TAG_COLD"
  | "TAG_DISQUALIFIED"
  | "WEBHOOK_AUTOMATION"
  | "CUSTOM_ROUTINE";

export interface AgentTriggerItem {
  id: string;
  key: string;
  name: string;
  description: string;
  category: AgentTriggerCategory;
  actionType: AgentTriggerActionType;
  enabled: boolean;
  keywords: string[];
  webhookUrl?: string;
  updatedAt: string;
}

export const INITIAL_AGENT_TRIGGERS: AgentTriggerItem[] = [
  // --- TRIGGERS DE ATENDIMENTO (INTAKE DE DADOS) ---
  {
    id: "trg_intake_name",
    key: "COLLECT_NAME",
    name: "Perguntar / Coletar Nome do Lead",
    description: "Triggers de atendimento: Coleta e valida o nome completo ou preferido do lead.",
    category: "intake",
    actionType: "COLLECT_NAME",
    enabled: true,
    keywords: ["qual seu nome", "meu nome e", "me chamo"],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "trg_intake_dependents",
    key: "COLLECT_DEPENDENTS",
    name: "Coletar Vidas & Dependentes",
    description: "Triggers de atendimento: Pergunta o número de pessoas ou dependentes para o plano de saúde.",
    category: "intake",
    actionType: "COLLECT_DEPENDENTS",
    enabled: true,
    keywords: ["quantas vidas", "dependentes", "quantas pessoas", "familia"],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "trg_intake_city",
    key: "COLLECT_CITY",
    name: "Coletar Cidade / Região",
    description: "Triggers de atendimento: Identifica a cidade e estado para verificar rede credenciada.",
    category: "intake",
    actionType: "COLLECT_CITY",
    enabled: true,
    keywords: ["qual cidade", "moro em", "regiao", "sao paulo", "rio de janeiro"],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "trg_intake_plan",
    key: "COLLECT_PLAN_TYPE",
    name: "Coletar Tipo de Plano",
    description: "Triggers de atendimento: Pergunta se o plano é Individual, Familiar, PME ou Empresarial (CNPJ).",
    category: "intake",
    actionType: "COLLECT_PLAN_TYPE",
    enabled: true,
    keywords: ["tipo de plano", "cnpj", "individual", "familiar", "pme"],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "trg_intake_urgency",
    key: "COLLECT_URGENCY",
    name: "Coletar Urgência da Contratação",
    description: "Triggers de atendimento: Identifica o prazo de contratação (Hoje, 30 dias ou Apenas pesquisando).",
    category: "intake",
    actionType: "COLLECT_URGENCY",
    enabled: true,
    keywords: ["urgencia", "prazo", "contratar hoje", "pesquisando"],
    updatedAt: new Date().toISOString(),
  },

  // --- TRIGGERS DE AÇÃO (TRANSFERIR, ETIQUETAR, RECUSAR, AUTOMAÇÃO) ---
  {
    id: "trg_action_transfer_human",
    key: "TRANSFER_TO_HUMAN",
    name: "Ação: Transferir para Atendente Humano",
    description: "Triggers de ação: Interrompe a IA e transfere o atendimento para a equipe humana.",
    category: "action",
    actionType: "TRANSFER_HUMAN",
    enabled: true,
    keywords: ["falar com atendente", "corretor", "humano", "falar com pessoa", "urgente", "especialista"],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "trg_action_tag_hot",
    key: "QUALIFY_HOT",
    name: "Ação: Qualificar e Etiquetar Quente (Hot)",
    description: "Triggers de ação: Marca como Quente e envia para distribuição com prioridade.",
    category: "action",
    actionType: "TAG_HOT",
    enabled: true,
    keywords: ["cnpj", "pme", "plano empresarial", "urgencia maxima", "contratar hoje"],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "trg_action_tag_warm",
    key: "QUALIFY_WARM",
    name: "Ação: Qualificar e Etiquetar Morno (Warm)",
    description: "Triggers de ação: Marca como Morno e disponibiliza na fila de distribuição.",
    category: "action",
    actionType: "TAG_WARM",
    enabled: true,
    keywords: ["gostaria de cotacao", "valores", "qual o preco", "me mande proposta"],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "trg_action_opt_out",
    key: "MARK_OPT_OUT",
    name: "Ação: Registrar Recusa / Sem Interesse",
    description: "Triggers de ação: Marca como Frio, interrompe a IA e transfere para a lista de leads.",
    category: "action",
    actionType: "TAG_COLD",
    enabled: true,
    keywords: ["nao tenho interesse", "nao quero", "sem interesse", "cancelar", "ja tenho plano"],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "trg_action_wrong_number",
    key: "MARK_WRONG_NUMBER",
    name: "Ação: Registrar Número Errado",
    description: "Triggers de ação: Marca como Número Errado e transfere para a lista de leads.",
    category: "action",
    actionType: "TAG_DISQUALIFIED",
    enabled: true,
    keywords: ["nao sou", "numero errado", "engano", "pessoa errada", "nao conheco"],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "trg_action_automation",
    key: "WEBHOOK_AUTOMATION_TEMPLATE",
    name: "Ação: Disparar Automação Externa (Webhook)",
    description: "Triggers de ação: Dispara webhook e automações personalizadas de terceiros.",
    category: "action",
    actionType: "WEBHOOK_AUTOMATION",
    enabled: false,
    keywords: ["integracao externa", "gatilho personalizado"],
    webhookUrl: "https://api.ancorasaude.cloud/webhooks/automation-trigger",
    updatedAt: new Date().toISOString(),
  },
];

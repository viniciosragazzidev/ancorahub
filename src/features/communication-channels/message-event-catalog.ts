export const MESSAGE_RESOURCE_KINDS = ["meta_template", "free_message"] as const;
export type MessageResourceKind = (typeof MESSAGE_RESOURCE_KINDS)[number];

export type MessageEventAudience = "lead" | "client" | "user";
export type MessageWindowRule = "meta_required_without_window" | "corporate_internal";

export type MessageEventVariable = {
  key: string;
  label: string;
  aliases?: readonly string[];
  fallback: string;
  urlOnly?: boolean;
};

export type MessageEventDefinition = {
  key: string;
  purpose: string;
  label: string;
  description: string;
  audience: MessageEventAudience;
  windowRule: MessageWindowRule;
  variables: readonly MessageEventVariable[];
};

const brokerName = {
  key: "corretor_nome",
  label: "Nome do corretor",
  aliases: ["nome_corretor", "broker_name"],
  fallback: "Corretor(a)",
} as const;

const leadName = {
  key: "lead_nome",
  label: "Nome do lead",
  aliases: ["nome_lead", "nome_cliente", "cliente_nome", "customer_name", "nome"],
  fallback: "Cliente",
} as const;

const leadId = {
  key: "lead_id",
  label: "Identificador do lead",
  aliases: ["id_lead"],
  fallback: "",
  urlOnly: true,
} as const;

/**
 * Only registered events are configurable. Adding an item requires a real
 * producer that emits the matching purpose with variables in this exact order.
 */
export const MESSAGE_EVENT_CATALOG = [
  {
    key: "FIRST_CONTACT",
    purpose: "leadQualification",
    label: "Primeiro contato da qualificação",
    description: "Abre a conversa com o lead antes das perguntas da qualificação.",
    audience: "lead",
    windowRule: "meta_required_without_window",
    variables: [
      leadName,
      { key: "nome_bot", label: "Nome do assistente", aliases: ["bot_name"], fallback: "Assistente" },
      { key: "empresa", label: "Nome da empresa", aliases: ["company"], fallback: "sua corretora" },
    ],
  },
  {
    key: "LEAD_ASSIGNMENT",
    purpose: "brokerLeadNotification",
    label: "Novo lead atribuído ao corretor",
    description: "Avisa o corretor depois que a responsabilidade pelo lead foi persistida.",
    audience: "user",
    windowRule: "corporate_internal",
    variables: [
      { key: "cargo", label: "Cargo do corretor", aliases: ["broker_role"], fallback: "Corretor(a)" },
      brokerName,
      leadName,
      { key: "produto_interesse", label: "Produto de interesse", aliases: ["interesse", "product_interest"], fallback: "Plano de saúde" },
      leadId,
    ],
  },
  {
    key: "LEAD_OFFER",
    purpose: "newLeadAssignment",
    label: "Oferta de lead para aceite",
    description: "Convida um corretor elegível a aceitar um lead da fila.",
    audience: "user",
    windowRule: "corporate_internal",
    variables: [
      brokerName,
      { key: "empresa", label: "Nome da empresa", aliases: ["company"], fallback: "sua corretora" },
      { key: "tipo_lead", label: "Tipo do lead", aliases: ["lead_type"], fallback: "Lead" },
      { key: "unidade", label: "Unidade", aliases: ["branch_name"], fallback: "Unidade" },
      { key: "tempo_resposta", label: "Tempo para resposta", aliases: ["timeout_minutes"], fallback: "15" },
      leadId,
    ],
  },
  {
    key: "LEAD_ASSIGNMENT_CONFIRMED",
    purpose: "leadAssignmentConfirmed",
    label: "Aceite confirmado e dados do lead",
    description: "Entrega ao corretor os dados do lead depois do aceite confirmado.",
    audience: "user",
    windowRule: "corporate_internal",
    variables: [
      brokerName,
      leadName,
      { key: "telefone_cliente", label: "Telefone do lead", aliases: ["lead_phone", "cliente_telefone"], fallback: "Sem telefone" },
      { key: "interesse", label: "Interesse", aliases: ["produto_interesse"], fallback: "Plano de saúde" },
      { key: "tipo", label: "Tipo de contratação", aliases: ["tipo_lead"], fallback: "Individual" },
      { key: "n_dependentes", label: "Número de dependentes", aliases: ["dependentes"], fallback: "0" },
      leadId,
    ],
  },
  {
    key: "LEAD_ASSIGNMENT_UNAVAILABLE",
    purpose: "leadAssignmentUnavailable",
    label: "Lead indisponível",
    description: "Avisa que o lead já foi assumido ou não está mais disponível.",
    audience: "user",
    windowRule: "corporate_internal",
    variables: [brokerName],
  },
  {
    key: "LEAD_ASSIGNMENT_EXPIRED",
    purpose: "leadAssignmentExpired",
    label: "Oferta de lead expirada",
    description: "Avisa o corretor quando o prazo de aceite termina.",
    audience: "user",
    windowRule: "corporate_internal",
    variables: [brokerName],
  },
  {
    key: "BROKER_WELCOME",
    purpose: "brokerInvitation",
    label: "Primeiro acesso do corretor",
    description: "Envia o convite corporativo para criação do acesso.",
    audience: "user",
    windowRule: "corporate_internal",
    variables: [
      { key: "nome", label: "Nome do convidado", aliases: ["corretor_nome"], fallback: "Corretor(a)" },
      { key: "empresa", label: "Nome da empresa", aliases: ["company"], fallback: "sua corretora" },
      { key: "cargo", label: "Cargo", aliases: ["role"], fallback: "Corretor" },
    ],
  },
  {
    key: "TASK_REMINDER",
    purpose: "taskReminder",
    label: "Lembrete de tarefa comercial",
    description: "Lembra um membro da equipe sobre uma tarefa pendente.",
    audience: "user",
    windowRule: "corporate_internal",
    variables: [
      { key: "nome_usuario", label: "Nome do usuário", aliases: ["nome"], fallback: "Usuário" },
      { key: "tarefa", label: "Tarefa", fallback: "Tarefa agendada" },
      { key: "data_hora", label: "Data e hora", fallback: "Hoje" },
    ],
  },
  {
    key: "CLIENT_NOTICE",
    purpose: "clientNotice",
    label: "Aviso geral ao cliente",
    description: "Envia uma comunicação operacional para um cliente existente.",
    audience: "client",
    windowRule: "meta_required_without_window",
    variables: [
      { ...leadName, key: "nome_cliente" },
      { key: "mensagem", label: "Mensagem", aliases: ["message"], fallback: "" },
    ],
  },
] as const satisfies readonly MessageEventDefinition[];

export type MessageEventKey = (typeof MESSAGE_EVENT_CATALOG)[number]["key"];

export function getMessageEventByKey(key: string) {
  return MESSAGE_EVENT_CATALOG.find((event) => event.key === key) ?? null;
}

export function getMessageEventByPurpose(purpose: string) {
  return MESSAGE_EVENT_CATALOG.find((event) => event.purpose === purpose) ?? null;
}

function normalizedKey(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function resolveEventVariableKey(event: MessageEventDefinition, requestedKey: string) {
  const requested = normalizedKey(requestedKey);
  return event.variables.find((variable) =>
    normalizedKey(variable.key) === requested
    || variable.aliases?.some((alias) => normalizedKey(alias) === requested),
  )?.key ?? null;
}

export function buildEventVariableValues(event: MessageEventDefinition, rawVariables: readonly string[]) {
  return Object.fromEntries(event.variables.map((variable, index) => [
    variable.key,
    rawVariables[index]?.trim() || variable.fallback,
  ]));
}

export function renderEventFreeMessage(
  event: MessageEventDefinition,
  content: string,
  rawVariables: readonly string[],
) {
  const values = buildEventVariableValues(event, rawVariables);
  return content.replace(/\{\{([^}]+)\}\}/g, (_match, requestedKey: string) => {
    const positionalIndex = /^\d+$/.test(requestedKey.trim())
      ? Number(requestedKey.trim()) - 1
      : -1;
    const key = positionalIndex >= 0
      ? event.variables.filter((variable) => !variable.urlOnly)[positionalIndex]?.key ?? null
      : resolveEventVariableKey(event, requestedKey);
    return key ? values[key] ?? "" : "";
  });
}

export function getFreeMessageUnknownVariables(event: MessageEventDefinition, variables: readonly string[]) {
  return variables.filter((variable) => !resolveEventVariableKey(event, variable));
}

export function buildAutomaticMetaVariableMappings(
  event: MessageEventDefinition,
  templateVariables: readonly string[],
) {
  const bodyVariables = event.variables.filter((variable) => !variable.urlOnly);
  const mappings: Record<string, string> = {};
  for (const [index, placeholder] of templateVariables.entries()) {
    const eventKey = /^\d+$/.test(placeholder)
      ? bodyVariables[index]?.key ?? null
      : resolveEventVariableKey(event, placeholder);
    if (!eventKey) return { valid: false as const, unknown: placeholder, mappings: {} };
    mappings[placeholder] = eventKey;
  }
  return { valid: true as const, mappings };
}

export function buildMetaProviderVariables(
  event: MessageEventDefinition,
  rawVariables: readonly string[],
  templateVariables: readonly string[],
  mappings: Record<string, string>,
) {
  const values = buildEventVariableValues(event, rawVariables);
  return templateVariables.map((placeholder) => values[mappings[placeholder] ?? ""] ?? "");
}

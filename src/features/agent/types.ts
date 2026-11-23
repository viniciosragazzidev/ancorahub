/**
 * Agente do diretor (plano: docs/implementations/active/2026-11-21-agente-diretor.md).
 * Tipos comuns ao servidor, ao laboratório e à gaveta. Nada aqui importa banco nem sessão.
 */

/** Nível de confirmação (§4.1 do plano). "fora" nem entra no catálogo. */
export type ConfirmLevel = "direto" | "toque" | "forte";

/** Anotações no estilo MCP (readOnlyHint, destructiveHint, openWorldHint) usadas pela política. */
export type ToolRisk = {
  readOnly: boolean;
  destructive?: boolean;
  /** Efeito fora do CRM (mensagem ao cliente). */
  external?: boolean;
  /** Notifica pessoas da equipe. */
  notifies?: boolean;
};

export type AgentTopic = "consulta" | "plantoes" | "distribuicao" | "equipe" | "leads" | "conversas" | "config" | "sistema";

/** Como desfazer: outra ferramenta do catálogo e a entrada dela. */
export type UndoSpec = { tool: string; input: Record<string, unknown>; label: string };

/** Resultado que toda ferramenta devolve (o modelo lê `message`; a gaveta lê o resto). */
export type ToolResult<D = unknown> = {
  ok: boolean;
  /** Frase curta em pt-BR com o que aconteceu, com nomes, datas e horários. */
  message: string;
  data?: D;
  /** Tela de referência ("Ver na tela"). */
  href?: string;
  warning?: string;
  /** Presente só em escrita que deu certo e tem inversa. A gaveta mostra "Desfazer" com o id do registro. */
  undo?: UndoSpec;
  /** Id do registro em agent_actions (para o Desfazer); null quando a trilha não pôde ser gravada. */
  actionId?: string | null;
  /** Erro de negócio: o que corrigir. Volta ao modelo como resultado, não como exceção. */
  error?: { code: string; fix: string };
};

/** Uma vaga de plantão (ocorrência de um plantão numa data). */
export type SeatOccurrence = {
  /** `${scheduleId}:${dutyDate}` (mesmo id da escala mensal). */
  id: string;
  scheduleId: string;
  scheduleName: string;
  /** AAAA-MM-DD */
  dutyDate: string;
  /** HH:MM (pode vir HH:MM:SS) */
  startsAt: string;
  endsAt: string;
  typeId: string | null;
  typeName: string | null;
  attendanceMode: "online" | "presencial" | null;
  maximumBrokers: number | null;
  minimumBrokers: number;
  /** Quem já está escalado (ids). */
  brokerIds: string[];
  /** Corretores cuja unidade participa do tipo (fora dela, só "escalar mesmo assim"). */
  allowedBrokerIds: string[];
  started: boolean;
  ended: boolean;
  /**
   * "published": já vale; "draft": só no rascunho do mês (falta publicar);
   * "avulso": plantão de um dia criado fora da escala mensal (escala semanal do plantão, sem plano).
   */
  source: "published" | "draft" | "avulso";
  /** Plano mensal (vazio no avulso). */
  planId: string;
};

/** Lead como o agente vê: sem telefone inteiro nem dado sensível (só os 4 últimos dígitos). */
export type LeadSummary = {
  id: string;
  name: string;
  status: string;
  brokerId: string | null;
  brokerName: string | null;
  queueName: string | null;
  /** hot | warm | cold | null */
  temperature: string | null;
  /** waiting: sem dono esperando distribuição; assigned; manual_hold; offered… */
  distributionStatus: string | null;
  createdAt: string;
  phoneTail: string | null;
};

export type LeadFilter = {
  text?: string | null;
  withoutBroker?: boolean;
  brokerId?: string | null;
  status?: string | null;
  limit: number;
};

export type Person = {
  id: string;
  name: string;
  role: "director" | "manager" | "supervisor" | "broker";
  jobTitle: string;
  status: string;
  /** available | paused | offline… */
  availability: string;
  branchId: string | null;
  branchName: string | null;
  /** Id da ligação com a empresa (a tela Equipe edita por ele). */
  membershipId?: string;
  email?: string | null;
  customRoleId?: string | null;
};

export type Branch = { id: string; name: string; active: boolean; acceptingLeads?: boolean };

export type QueueInfo = { id: string; name: string; branchName: string | null; mode: "automatic" | "manual"; active: boolean };

export type PendingInvite = { id: string; name: string | null; email: string | null; status: string; expiresAt: string | null };

export type Announcement = {
  active: boolean;
  title: string;
  body: string;
  endsOn: string | null;
  art: string;
  tone: string;
  button: { label: string; href: string } | null;
};

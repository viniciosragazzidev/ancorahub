export type ConversationIdentity = { displayName?: string; phone?: string; stableIdentifier?: string };
export type ResolveState = { status: "INITIALIZING" | "NO_CONVERSATION" | "UNIDENTIFIED" | "LOADING" | "FOUND" | "NOT_FOUND" | "FORBIDDEN" | "OFFLINE" | "ERROR" | "SESSION_EXPIRED"; message?: string; lead?: Record<string, unknown> };

/**
 * Lead como a gaveta mostra. Só entra o que a allowlist de campos do servidor permite (E0a/E2): CPF,
 * comissão e observações internas nunca chegam aqui. Os campos novos são opcionais, porque o servidor
 * pode ainda não enviá-los; a gaveta mostra um traço quando faltam.
 */
export type Temperatura = "quente" | "morno" | "frio" | "sem-dados";

export type LeadAmpliado = {
  id: string;
  version: number;
  name: string;
  phoneMasked: string;
  etapa: string;
  unidade?: string;
  corretor?: string;
  proximoPasso?: { titulo: string; prazo: string | null } | null;
  temperatura?: Temperatura;
  plano?: string;
  vidas?: number;
  valorMensal?: number;
  fila?: string;
  plantao?: string;
  chegouEm?: string | null;
  /** Só tipo e data, nunca o conteúdo da interação. */
  historico?: { tipo: string; data: string }[];
};

export type EstadoGaveta =
  | { tipo: "carregando" }
  | { tipo: "sem-lead" }
  | { tipo: "sem-conexao" }
  | { tipo: "erro" }
  | { tipo: "indisponivel" }
  | { tipo: "desligada" }
  | { tipo: "lead"; lead: LeadAmpliado };

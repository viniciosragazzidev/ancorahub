import type { LiveSeal, LiveSeverity, LiveStatus, LiveStatusEvent } from "@/components/lite/status/types";

export type { LiveSeal, LiveSeverity, LiveStatus, LiveStatusEvent };

export type LiveRole = "director" | "manager" | "supervisor" | "broker";

/**
 * Escopo do status vivo, igual ao das telas de hoje (buildNocLeadScope): diretor vê a empresa, gestor a unidade,
 * supervisor a equipe, corretor o dele. `key` é a chave de cache: nunca o objeto de sessão.
 */
export type LiveScope = {
  tenantId: string;
  role: LiveRole;
  branchId: string | null;
  userId: string;
  key: string;
  /** Pode abrir a Qualificação (permissão acessar_qualificacao_ia). */
  canOpenQualification: boolean;
};

export type LiveStatusId =
  | "frios"
  | "frios-recuperados"
  | "qualificacao-ia"
  | "aguardando-corretor"
  | "ofertas"
  | "primeiro-contato"
  | "plantao"
  | "whatsapp-fila"
  | "duty-reminders";

export type LiveProvider = {
  id: LiveStatusId;
  /** Validade do cache compartilhado por escopo. */
  ttlMs: number;
  /** Null: não se aplica agora (ex.: nenhuma fila com liberação dos frios). */
  load(scope: LiveScope, now: Date): Promise<LiveStatus | null>;
};

export type LiveStatusPayload = { statuses: LiveStatus[]; seals: LiveSeal[] };

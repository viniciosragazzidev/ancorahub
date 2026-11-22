import type { Person, SeatOccurrence } from "./types";

/**
 * O que as ferramentas precisam do CRM. No servidor (`backend-server.ts`) cada método chama a consulta ou a ação
 * que a tela já usa, com a sessão do diretor; no laboratório e nos evals, um mundo em memória (`backend-memory.ts`).
 */
export type DutyNowBroker = {
  id: string;
  /** Linha da escala (para pausar só neste plantão). */
  assignmentId: string;
  name: string;
  /** confirmed | pending | absent | expired | none (sem registro de presença hoje) */
  presence: "confirmed" | "pending" | "absent" | "expired" | "none";
  /** Pausado só neste plantão. */
  pausedHere: boolean;
  /** Pausado no recebimento geral. */
  pausedGlobal: boolean;
};

export type DutyNow = {
  scheduleId: string;
  scheduleName: string;
  dutyDate: string;
  startsAt: string;
  endsAt: string;
  minimumBrokers: number;
  queueName: string | null;
  brokers: DutyNowBroker[];
};

export type AgentActionRecord = {
  toolCallId: string;
  tool: string;
  requestText: string | null;
  input: Record<string, unknown>;
  approval: "auto" | "user";
  status: "done" | "failed";
  message: string;
  undo: { tool: string; input: Record<string, unknown>; label: string } | null;
  durationMs: number;
};

export interface AgentBackend {
  now(): Date;
  listPeople(): Promise<Person[]>;
  /** Vagas (ocorrências) da escala do mês entre duas datas AAAA-MM-DD, publicadas ou em rascunho. */
  listSeats(range: { from: string; until: string }): Promise<SeatOccurrence[]>;
  dutyNow(): Promise<DutyNow[]>;
  /** Escala na ocorrência. Lança Error com a mensagem da regra quando não pode. */
  addSeat(occurrence: SeatOccurrence, brokerId: string, force: boolean): Promise<void>;
  removeSeat(occurrence: SeatOccurrence, brokerId: string): Promise<void>;
  /** Pausa ou retoma a pessoa só neste plantão (continua escalada). */
  pauseOnDuty(scheduleId: string, assignmentId: string, paused: boolean): Promise<void>;
  /** Pausa ou retoma o recebimento geral de leads dos corretores. */
  setAvailability(brokerIds: string[], target: "available" | "paused"): Promise<void>;
  /** Grava a trilha em agent_actions; devolve o id ou null (tabela ausente, erro). Idempotente por toolCallId. */
  record(entry: AgentActionRecord): Promise<string | null>;
  /** Resultado já gravado deste toolCallId (reenvio não executa duas vezes). */
  recorded(toolCallId: string): Promise<{ id: string; message: string; status: string } | null>;
}

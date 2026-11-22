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
  /** false: começa nas próximas horas (para marcar falta ou liberar presença antes). */
  running?: boolean;
  brokers: DutyNowBroker[];
};

/** Rodízio de um plantão em andamento: a ordem de quem recebe e quem está fora da vez. */
export type DutyQueueOrder = {
  scheduleId: string;
  dutyDate: string;
  scheduleName: string;
  order: Array<{ id: string; name: string; position: number; isNext: boolean }>;
  blocked: Array<{ id: string; name: string; reason: string }>;
  /** true: o diretor já reordenou; false: ordem automática. */
  manual: boolean;
};

/** Situação da escala de um mês (para publicar ou ler). */
export type MonthPlanSummary = {
  id: string;
  monthKey: string;
  status: "draft" | "published";
  occurrences: number;
  assigned: number;
  belowMinimum: number;
  /** Problemas que impedem publicar. */
  problems: string[];
  warnings: string[];
  /** Publicar este rascunho substitui uma escala já publicada nas datas que não terminaram. */
  replacesPublished: boolean;
  /** Pessoas escaladas no rascunho (quem recebe aviso ao publicar). */
  people: number;
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
  /** Plantões rodando e os que começam nas próximas 24 h. */
  dutySoon(): Promise<DutyNow[]>;
  /** Marca ou desfaz falta na ocorrência atual ou próxima (avisa a pessoa). */
  markAbsence(scheduleId: string, assignmentId: string, absent: boolean): Promise<void>;
  /** Libera a presença sem o clique da pessoa. `needsNote`: presencial sem foto pede o motivo. */
  releasePresence(scheduleId: string, assignmentId: string, note: string | null): Promise<{ ok: true } | { ok: false; reason: string; needsNote?: boolean }>;
  /** Escala na ocorrência. Lança Error com a mensagem da regra quando não pode. */
  addSeat(occurrence: SeatOccurrence, brokerId: string, force: boolean): Promise<void>;
  removeSeat(occurrence: SeatOccurrence, brokerId: string): Promise<void>;
  /** Pausa ou retoma a pessoa só neste plantão (continua escalada). */
  pauseOnDuty(scheduleId: string, assignmentId: string, paused: boolean): Promise<void>;
  /** Ordem do rodízio dos plantões em andamento. */
  queueOrders(): Promise<DutyQueueOrder[]>;
  /** Grava a ordem manual do rodízio da ocorrência em andamento. */
  setQueueOrder(scheduleId: string, dutyDate: string, brokerIds: string[]): Promise<void>;
  /** Volta o rodízio ao automático. */
  resetQueueOrder(scheduleId: string, dutyDate: string): Promise<void>;
  /** Marca a pessoa como online dentro de um plantão presencial (ou volta a seguir o plantão). */
  setOnlineMode(scheduleId: string, assignmentId: string, online: boolean): Promise<void>;
  /** Reenvia o convite de confirmação de presença por WhatsApp. */
  sendPresenceInvite(scheduleId: string, assignmentId: string): Promise<{ delivered: boolean }>;
  /** Última versão da escala do mês (rascunho ou publicada), ou null. */
  monthPlan(monthKey: string): Promise<MonthPlanSummary | null>;
  /** Publica o rascunho: grava a escala, avisa todos, tira quem saiu. */
  publishPlan(planId: string): Promise<void>;
  /** Tira o dia inteiro da escala (feriado) ou devolve o dia para a próxima geração. Devolve a mensagem da tela. */
  excludeDay(monthKey: string, dutyDate: string, restore: boolean): Promise<string>;
  /** Pausa ou retoma o recebimento geral de leads dos corretores. */
  setAvailability(brokerIds: string[], target: "available" | "paused"): Promise<void>;
  /** Grava a trilha em agent_actions; devolve o id ou null (tabela ausente, erro). Idempotente por toolCallId. */
  record(entry: AgentActionRecord): Promise<string | null>;
  /** Resultado já gravado deste toolCallId (reenvio não executa duas vezes). */
  recorded(toolCallId: string): Promise<{ id: string; message: string; status: string } | null>;
}

/**
 * Etapa do lead (plano de recuperação, §4): uma função pura que lê os campos que já existem e devolve a etapa,
 * o passo na régua e o próximo passo. A tela, o hover card, o funil e o Sasá leem esta mesma função.
 * Plano: docs/implementations/active/2026-11-21-recuperacao-de-leads.md
 */

export type JourneyPhase = "qualificacao" | "recuperacao" | "corretor" | "negociacao" | "encerrado";

export type JourneyCode =
  | "Q1" | "Q2" | "Q3" | "Q4" | "Q5"
  | "R1" | "R2" | "R3" | "R4" | "R5" | "R6"
  | "X1" | "X2" | "SW"
  | "N1" | "N2" | "N3" | "N4" | "N5" | "N6" | "N7";

export type LeadJourney = {
  phase: JourneyPhase;
  code: JourneyCode;
  /** Rótulo curto da etapa ("Em conversa"). */
  label: string;
  /** Subpasso ("Idades"), quando há. */
  detail: string | null;
  /** Posição na régua Qualificação → Corretor → Negociação (1 a JOURNEY_TOTAL). */
  step: number;
  total: number;
  /** Por que está aqui ("Parou de responder há 2 h"). */
  reason: string | null;
  /** O que acontece depois ("IA retoma às 14:30"). */
  nextStep: string | null;
  /** Tom da pílula. */
  tone: "info" | "secondary" | "pending" | "success" | "destructive";
};

/** Marcas manuais ou da cadência gravadas em `qualification_details.recovery`. */
export type RecoveryMark = "call_queue" | "bad_moment" | "nurture" | "do_not_contact";

export type JourneyCadence = {
  /** Toques automáticos já enviados sem resposta. */
  sent: number;
  /** Total previsto antes da fila de ligação. */
  total: number;
  /** Quando sai o próximo, se a cadência sabe. */
  nextAt?: Date | string | null;
  /** A cadência terminou ou parou. */
  stopped?: boolean;
};

export type JourneyInput = {
  now?: Date;
  status: string;
  qualificationStatus?: string | null;
  corretorId?: string | null;
  assignedAt?: Date | string | null;
  firstContactAt?: Date | string | null;
  distributionStatus?: string | null;
  hasWhatsapp?: boolean;
  /** Primeira mensagem da IA ou do turbo para o lead. */
  aiFirstContactAt?: Date | string | null;
  lastInboundAt?: Date | string | null;
  inboundCount?: number;
  lastAiMessageAt?: Date | string | null;
  optedOut?: boolean;
  wrongNumber?: boolean;
  /** Chaves da memória da IA já coletadas (`collectedFields`). */
  collectedFields?: readonly string[];
  cadence?: JourneyCadence | null;
  /** Marcas da recuperação (fases 4 e 5). */
  recovery?: { state: RecoveryMark; until?: Date | string | null } | null;
  /** Prazo do corretor para o primeiro contato, em minutos. */
  firstContactSlaMinutes?: number;
};

/** Ordem da régua: Chegou … Ganho. */
const TRACK = ["Q1", "Q2", "Q3", "Q4", "Q5", "N1", "N2", "N3", "N4", "N5", "N6"] as const;
export const JOURNEY_TOTAL = TRACK.length;

/** Ordem em que a IA pergunta (a mesma da memória), com o rótulo da tela. */
export const QUALIFICATION_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "planType", label: "Tipo de plano" },
  { key: "numberOfLives", label: "Vidas" },
  { key: "age", label: "Idades" },
  { key: "city", label: "Cidade" },
  { key: "customerName", label: "Nome" },
  { key: "email", label: "E-mail" },
];

const HOT = new Set(["hot", "qualified"]);
const NEGOTIATION: Record<string, { code: JourneyCode; label: string }> = {
  distributed: { code: "N1", label: "Primeiro contato" },
  in_contact: { code: "N1", label: "Primeiro contato" },
  awaiting_reply: { code: "N1", label: "Primeiro contato" },
  quote_sent: { code: "N2", label: "Cotação enviada" },
  negotiation: { code: "N3", label: "Negociação" },
  documentation_pending: { code: "N4", label: "Documentos" },
  under_analysis: { code: "N5", label: "Em análise na operadora" },
};

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function stepOf(code: JourneyCode) {
  const index = (TRACK as readonly string[]).indexOf(code);
  return index + 1;
}

/** "agora", "12 min", "3 h", "2 dias". */
export function formatElapsed(from: Date, now: Date) {
  const minutes = Math.max(0, Math.round((now.getTime() - from.getTime()) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 dia" : `${days} dias`;
}

const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const dayFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

/** "às 14:30" no mesmo dia; "em 22/11" depois. */
export function formatWhen(at: Date, now: Date) {
  const sameDay = dayFormat.format(at) === dayFormat.format(now);
  return sameDay ? `às ${timeFormat.format(at)}` : `em ${dayFormat.format(at)}`;
}

/** Próximo campo que a IA vai pedir. */
export function currentField(collected: readonly string[] | undefined) {
  const done = new Set(collected ?? []);
  return QUALIFICATION_FIELDS.find((field) => !done.has(field.key)) ?? null;
}

function cadenceNext(cadence: JourneyCadence | null | undefined, now: Date, fallback: string) {
  if (!cadence) return fallback;
  if (cadence.stopped || cadence.sent >= cadence.total) return "Fim dos lembretes automáticos";
  const nextAt = toDate(cadence.nextAt);
  const which = `Lembrete ${cadence.sent + 1} de ${cadence.total}`;
  return nextAt ? `${which} ${formatWhen(nextAt, now)}` : which;
}

export function deriveLeadJourney(input: JourneyInput): LeadJourney {
  const now = input.now ?? new Date();
  const make = (code: JourneyCode, phase: JourneyPhase, label: string, rest: Partial<LeadJourney> = {}, stepCode: JourneyCode = code): LeadJourney => ({
    phase, code, label, detail: null, step: Math.max(1, stepOf(stepCode)), total: JOURNEY_TOTAL, reason: null, nextStep: null, tone: "secondary", ...rest,
  });
  const qualification = input.qualificationStatus ?? "pending";
  const lastInbound = toDate(input.lastInboundAt);
  const lastAi = toDate(input.lastAiMessageAt);
  const inboundCount = input.inboundCount ?? (lastInbound ? 1 : 0);

  // Encerrados primeiro: valem por cima de qualquer cadência.
  if (input.status === "converted") return make("N6", "encerrado", "Ganho", { tone: "success" });
  if (input.status === "lost") return make("N7", "encerrado", "Perdido", { tone: "destructive", nextStep: "Volta para nutrição em 60 dias se o motivo for preço ou momento" }, "N1");
  if (input.optedOut || input.wrongNumber || input.recovery?.state === "do_not_contact") {
    return make("X1", "encerrado", "Não contatar", { tone: "destructive", reason: input.wrongNumber ? "Número errado" : input.optedOut ? "Pediu para não receber mensagens" : "Marcado pela equipe", nextStep: "Nunca mais recebe mensagem automática" }, "Q2");
  }
  if (qualification === "unqualified" || qualification === "disqualified") {
    return make("X2", "encerrado", "Descartado", { tone: "secondary", reason: "Sem perfil para o plano" }, "Q3");
  }

  // Depois do corretor.
  if (input.corretorId) {
    const stage = NEGOTIATION[input.status] ?? NEGOTIATION.distributed;
    const journey = make(stage.code, stage.code === "N1" ? "corretor" : "negociacao", stage.label, { tone: "info" });
    if (input.status === "awaiting_reply") journey.detail = "Aguardando retorno";
    if (stage.code === "N1") {
      const assigned = toDate(input.assignedAt);
      const sla = input.firstContactSlaMinutes ?? 15;
      if (toDate(input.firstContactAt)) journey.nextStep = "Corretor em contato: próximo é a cotação";
      else if (assigned && now.getTime() - assigned.getTime() > sla * 60_000) {
        journey.nextStep = `Corretor: 1º contato atrasado ${formatElapsed(new Date(assigned.getTime() + sla * 60_000), now)}`;
        journey.tone = "pending";
      } else journey.nextStep = "Corretor faz o 1º contato";
    }
    return journey;
  }

  // Marcas da recuperação (fila de ligação, momento ruim, nutrição).
  if (input.recovery?.state === "call_queue") {
    return make("R4", "recuperacao", "Sem resposta: fila de ligação", { tone: "pending", reason: "Terminou os lembretes sem responder", nextStep: "Call Âncora liga em até 3 tentativas" }, "Q2");
  }
  if (input.recovery?.state === "bad_moment" || input.recovery?.state === "nurture") {
    const until = toDate(input.recovery.until);
    const label = input.recovery.state === "bad_moment" ? "Momento ruim" : "Nutrição";
    return make(input.recovery.state === "bad_moment" ? "R5" : "R6", "recuperacao", label, {
      tone: "secondary",
      nextStep: until ? `Próximo contato ${formatWhen(until, now)}` : "Um toque por mês, com motivo concreto",
    }, "Q2");
  }

  // Quente.
  if (HOT.has(qualification)) {
    if (input.distributionStatus === "queued" || input.distributionStatus === "assigning" || input.distributionStatus === "awaiting_unit") {
      return make("Q5", "qualificacao", "Aguardando corretor", { tone: "success", nextStep: "Um corretor da fila aceita o lead" });
    }
    const held = input.distributionStatus === "manual_hold";
    return make("Q4", "qualificacao", "Quente", { tone: "success", reason: held ? "Segurado para distribuição manual" : null, nextStep: held ? "Diretor distribui" : "Entra na fila do corretor" });
  }

  if (qualification === "warm") {
    return make("R3", "recuperacao", "Morno", { tone: "pending", reason: "Deu dados, mas não chegou a quente", nextStep: "Vai para a fila como morno" }, "Q3");
  }

  if (input.hasWhatsapp === false) {
    return make("SW", "qualificacao", "Sem WhatsApp", { tone: "destructive", reason: "O número não tem WhatsApp", nextStep: "Só por ligação" }, "Q1");
  }

  const aiFirst = toDate(input.aiFirstContactAt) ?? lastAi;
  if (!aiFirst) return make("Q1", "qualificacao", "Chegou", { tone: "info", nextStep: "IA manda a 1ª mensagem" });

  if (inboundCount === 0) {
    const silent = formatElapsed(aiFirst, now);
    const cold = qualification === "cold" || (input.cadence?.sent ?? 0) > 0;
    if (!cold) return make("Q2", "qualificacao", "Contatado", { tone: "info", reason: `1ª mensagem há ${silent}`, nextStep: cadenceNext(input.cadence, now, "Esperando a 1ª resposta") });
    return make("R1", "recuperacao", "Nunca respondeu", {
      tone: "pending",
      detail: input.cadence ? `${input.cadence.sent} de ${input.cadence.total} lembretes` : null,
      reason: `Sem resposta há ${silent}`,
      nextStep: cadenceNext(input.cadence, now, "Lembretes automáticos"),
    }, "Q2");
  }

  const field = currentField(input.collectedFields);
  const waitingCustomer = lastAi && (!lastInbound || lastAi.getTime() > lastInbound.getTime());
  if (qualification === "cold" || (waitingCustomer && input.cadence && input.cadence.sent > 0)) {
    return make("R2", "recuperacao", "Parou no meio", {
      tone: "pending",
      detail: field?.label ?? null,
      reason: lastAi ? `Parou de responder há ${formatElapsed(lastAi, now)}` : "Parou de responder",
      nextStep: cadenceNext(input.cadence, now, field ? `IA retoma pela pergunta de ${field.label.toLowerCase()}` : "IA retoma a conversa"),
    }, "Q3");
  }
  return make("Q3", "qualificacao", "Em conversa", {
    tone: "info",
    detail: field?.label ?? null,
    reason: waitingCustomer && lastAi ? `Esperando o cliente há ${formatElapsed(lastAi, now)}` : null,
    nextStep: waitingCustomer ? (field ? `Cliente responde: ${field.label.toLowerCase()}` : "Cliente responde") : field ? `IA pergunta: ${field.label.toLowerCase()}` : "IA fecha a qualificação",
  });
}

/** "Em conversa · Idades". */
export function journeyTitle(journey: LeadJourney) {
  return journey.detail ? `${journey.label} · ${journey.detail}` : journey.label;
}

/** Fase da régua para mostrar ao lado da barra. */
export function journeyPhaseLabel(journey: LeadJourney) {
  if (journey.phase === "recuperacao") return "Recuperação";
  if (journey.phase === "encerrado") return journey.code === "N6" ? "Ganho" : "Encerrado";
  if (journey.step <= stepOf("Q5")) return "Qualificação";
  if (journey.step === stepOf("N1")) return "Corretor";
  return "Negociação";
}

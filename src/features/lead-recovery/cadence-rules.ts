/**
 * Cadência única de recuperação (plano §5, fase 3), regras puras. Cobre os segmentos novos:
 *   - "stopped_midway" (R2, respondeu e parou): S2 +3 h e S3 +20 h em texto livre (dentro da janela de 24 h),
 *     S4 D+2, S5 D+4 e S6 D+7 por template de marketing (fora da janela, só Meta oficial);
 *   - "warm" (R3, morno com corretor que não fez o 1º contato): W2 +2 h e W3 +20 h, ponte da IA.
 * O S1 é o follow-up de silêncio que já existe; "nunca respondeu" (R1) continua no turbo (T1–T4).
 * Nada sai sem: recuperação ligada, conferência jurídica registrada, horário permitido e canal válido.
 */
import { saoPauloHour } from "@/features/qualification-turbo/approaches";

import { isRecoveryControl, type RecoveryChannelSetting, type RecoverySettings, type RecoveryStepId } from "./settings-core";

export type RecoverySegment = "stopped_midway" | "warm";
export type RecoveryChannel = "meta" | "waha";

export type RecoveryStepDef = {
  id: RecoveryStepId;
  segment: RecoverySegment;
  /** Minutos depois do início do silêncio (R2) ou da atribuição (morno). */
  afterMinutes: number;
  kind: "free" | "template";
  template?: string;
  /** Hora mínima do dia (São Paulo). */
  notBeforeHour?: number;
};

export const RECOVERY_STEPS: readonly RecoveryStepDef[] = [
  { id: "s2", segment: "stopped_midway", afterMinutes: 180, kind: "free" },
  { id: "s3", segment: "stopped_midway", afterMinutes: 20 * 60, kind: "free" },
  { id: "s4", segment: "stopped_midway", afterMinutes: 2 * 24 * 60, kind: "template", template: "anc_s4_cotacao", notBeforeHour: 10 },
  { id: "s5", segment: "stopped_midway", afterMinutes: 4 * 24 * 60, kind: "template", template: "anc_s5_ligacao", notBeforeHour: 10 },
  { id: "s6", segment: "stopped_midway", afterMinutes: 7 * 24 * 60, kind: "template", template: "anc_s6_despedida", notBeforeHour: 10 },
  { id: "w2", segment: "warm", afterMinutes: 120, kind: "free" },
  { id: "w3", segment: "warm", afterMinutes: 20 * 60, kind: "free" },
];

/** Nenhum lead recebe mais que isto de mensagens automáticas sem responder (§5.1, regra dos 6 toques). */
export const MAX_AUTOMATIC_TOUCHES = 6;
const MIN_GAP_MINUTES = 90;
const META_WINDOW_MS = 24 * 60 * 60_000;
/** Passo que ficou para trás mais que isto é pulado (o momento passou; o próximo assume). */
const STALE_AFTER_MINUTES = 26 * 60;
export const SAIR_FOOTER = "Se não quiser mais receber, responda SAIR.";

export type RecoveryTouchState = { step: string; status: string; attempt: number; errorCode: string | null; at: Date };

export type RecoveryCadenceInput = {
  now: Date;
  settings: RecoverySettings;
  segment: RecoverySegment;
  leadId: string;
  lead: { status: string; qualificationStatus: string | null; corretorId: string | null; firstContactAt: Date | null; recoveryState: string | null };
  conversation: { status: string; automationState: string | null; optOutAt: Date | null; wrongNumberAt: Date | null } | null;
  /** R2: hora da última pergunta da IA sem resposta; morno: hora da atribuição ao corretor. */
  startAt: Date;
  lastInboundAt: Date | null;
  lastMetaInboundAt: Date | null;
  /** Canal da conversa (última mensagem da IA). */
  conversationChannel: RecoveryChannel;
  wahaAvailable: boolean;
  /** Toques já registrados na tabela 0234 para este lead. */
  touches: readonly RecoveryTouchState[];
  /** Mensagens automáticas já enviadas desde startAt (S1, lembretes), para a regra dos 6 toques. */
  automaticSentSinceStart: number;
  /** Último envio automático para o lead (qualquer passo), para o intervalo mínimo. */
  lastAutomaticAt: Date | null;
  /** Templates que podem sair: aprovados na WABA ativa e Utility (DEC-155, 27/10: a qualificação não usa Marketing). */
  approvedTemplates: ReadonlySet<string>;
  /** Aprovados, mas de Marketing: barrados pela DEC-155 (o passo é pulado com esse motivo). */
  marketingTemplates?: ReadonlySet<string>;
};

export type RecoveryCadenceDecision =
  | { action: "stop"; reason: "disabled" | "legal_pending" | "control" | "replied" | "opted_out" | "closed" | "assigned" | "broker_contacted" | "human" | "meta_limit" }
  | { action: "finished"; next: "call_queue" | null }
  | { action: "wait"; reason: "too_early" | "outside_hours" | "gap" | "meta_limit_cooldown" }
  | { action: "skip"; step: RecoveryStepDef; reason: "step_disabled" | "template_not_approved" | "marketing_blocked" | "window_closed" | "no_channel" | "stale" }
  | { action: "send"; step: RecoveryStepDef; channel: RecoveryChannel; fallback: RecoveryChannel | null; attempt: number };

const CLOSED_LEAD = new Set(["lost", "converted"]);
const HUMAN = new Set(["WAITING_HUMAN", "HUMAN_ACTIVE"]);

/** Seg. a sáb. dentro da janela; domingo só para quem escreveu no próprio domingo. */
export function inRecoveryHours(now: Date, settings: RecoverySettings, lastInboundAt: Date | null) {
  const hour = saoPauloHour(now);
  if (hour < settings.sendStartHour || hour >= settings.sendEndHour) return false;
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Sao_Paulo" }).format(now);
  if (weekday !== "Sun") return true;
  if (!lastInboundAt) return false;
  const day = (date: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(date);
  return day(lastInboundAt) === day(now);
}

function channelsFor(setting: RecoveryChannelSetting, conversation: RecoveryChannel): RecoveryChannel[] {
  if (setting === "same") return [conversation, conversation === "meta" ? "waha" : "meta"];
  return [setting];
}

export function decideRecoveryTouch(input: RecoveryCadenceInput): RecoveryCadenceDecision {
  const { settings, now, lead, conversation } = input;
  const segmentOn = input.segment === "stopped_midway" ? settings.stoppedMidway : settings.warmBridge;
  if (!settings.enabled || !segmentOn) return { action: "stop", reason: "disabled" };
  if (!settings.legalReviewedAt) return { action: "stop", reason: "legal_pending" };
  if (isRecoveryControl(input.leadId, settings.controlPct)) return { action: "stop", reason: "control" };
  if (conversation?.optOutAt || conversation?.wrongNumberAt || lead.recoveryState === "do_not_contact") return { action: "stop", reason: "opted_out" };
  if (CLOSED_LEAD.has(lead.status) || lead.qualificationStatus === "unqualified" || lead.qualificationStatus === "disqualified") return { action: "stop", reason: "closed" };
  if (lead.recoveryState === "call_queue" || lead.recoveryState === "nurture" || lead.recoveryState === "bad_moment") return { action: "stop", reason: "closed" };
  if (conversation && HUMAN.has(conversation.status)) return { action: "stop", reason: "human" };
  if (input.segment === "stopped_midway" && lead.corretorId) return { action: "stop", reason: "assigned" };
  if (input.segment === "warm" && lead.firstContactAt) return { action: "stop", reason: "broker_contacted" };
  if (input.lastInboundAt && input.lastInboundAt.getTime() > input.startAt.getTime()) return { action: "stop", reason: "replied" };

  // Limite de marketing da Meta (131049): nunca insistir; 24 h de espera por erro e para no segundo.
  const limited = input.touches.filter((touch) => touch.errorCode === "131049");
  if (limited.length >= 2) return { action: "stop", reason: "meta_limit" };
  const lastLimit = limited.sort((a, b) => b.at.getTime() - a.at.getTime())[0];
  if (lastLimit && now.getTime() - lastLimit.at.getTime() < 24 * 60 * 60_000) return { action: "wait", reason: "meta_limit_cooldown" };

  const retryable = (touch: RecoveryTouchState) => (touch.status === "failed" || touch.status === "held") && (touch.errorCode === "131049" || touch.status === "held");
  const attemptsOf = (step: string) => input.touches.filter((touch) => touch.step === step).length;
  const done = new Set(input.touches.filter((touch) => !retryable(touch) || attemptsOf(touch.step) >= 3).map((touch) => touch.step));
  const steps = RECOVERY_STEPS.filter((step) => step.segment === input.segment);
  const next = steps.find((step) => !done.has(step.id));
  const sentCount = input.automaticSentSinceStart;
  if (!next || sentCount >= MAX_AUTOMATIC_TOUCHES) {
    return { action: "finished", next: input.segment === "stopped_midway" && settings.callQueue ? "call_queue" : null };
  }

  const elapsed = (now.getTime() - input.startAt.getTime()) / 60_000;
  if (elapsed < next.afterMinutes) return { action: "wait", reason: "too_early" };
  if (!settings.steps[next.id].enabled) return { action: "skip", step: next, reason: "step_disabled" };
  const following = steps[steps.indexOf(next) + 1];
  if (following && elapsed >= following.afterMinutes) return { action: "skip", step: next, reason: "stale" };
  if (elapsed > next.afterMinutes + STALE_AFTER_MINUTES && next.kind === "free") return { action: "skip", step: next, reason: "stale" };
  if (next.kind === "template" && !input.approvedTemplates.has(next.template!)) {
    return { action: "skip", step: next, reason: input.marketingTemplates?.has(next.template!) ? "marketing_blocked" : "template_not_approved" };
  }

  const metaWindowOpen = Boolean(input.lastMetaInboundAt && now.getTime() - input.lastMetaInboundAt.getTime() < META_WINDOW_MS);
  const valid: Record<RecoveryChannel, boolean> = {
    // Texto livre na Meta só com a janela de 24 h aberta; template não depende dela.
    meta: next.kind === "template" ? true : metaWindowOpen,
    // Template nunca sai por WAHA; texto livre só com a conversa já no WAHA.
    waha: next.kind === "free" && input.wahaAvailable,
  };
  const wanted = next.kind === "template" ? (["meta"] as RecoveryChannel[]) : channelsFor(settings.steps[next.id].channel, input.conversationChannel);
  const usable = wanted.filter((channel) => valid[channel]);
  if (!usable.length) return { action: "skip", step: next, reason: next.kind === "free" && !metaWindowOpen && wanted.includes("meta") && !input.wahaAvailable ? "window_closed" : "no_channel" };

  if (input.lastAutomaticAt && now.getTime() - input.lastAutomaticAt.getTime() < MIN_GAP_MINUTES * 60_000) return { action: "wait", reason: "gap" };
  const hourOk = inRecoveryHours(now, settings, input.lastInboundAt) && (next.notBeforeHour === undefined || saoPauloHour(now) >= next.notBeforeHour);
  if (!hourOk) return { action: "wait", reason: "outside_hours" };
  return { action: "send", step: next, channel: usable[0], fallback: usable[1] ?? null, attempt: attemptsOf(next.id) + 1 };
}

function firstNameOf(name: string | null) {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  if (!/^[\p{L}]{2,20}$/u.test(first)) return null;
  return first.charAt(0).toLocaleUpperCase("pt-BR") + first.slice(1).toLocaleLowerCase("pt-BR");
}

/** Texto livre dos passos S2, S3, W2 e W3, sempre com a saída visível. Nunca pergunta de saúde. */
export function buildRecoveryText(step: RecoveryStepId, input: { leadName: string | null; brokerName?: string | null; pendingAsk?: string | null }) {
  const name = firstNameOf(input.leadName);
  const hello = name ? `Oi, ${name}!` : "Oi!";
  const broker = firstNameOf(input.brokerName ?? null);
  const body = (() => {
    switch (step) {
      case "s2":
        return input.pendingAsk
          ? `${hello} Pra eu seguir com a sua cotação, só falta ${input.pendingAsk}. Pode me responder por aqui mesmo.`
          : `${hello} Ainda dá pra seguir com a sua cotação de plano de saúde. Posso continuar?`;
      case "s3":
        return `${hello} Posso já te mandar uma simulação com o que você me passou? É só responder SIM.`;
      case "w2":
        return `${hello} ${broker ? `O ${broker}, nosso especialista,` : "Nosso especialista"} já recebeu o seu pedido e vai te chamar. Enquanto isso, quer que eu adiante alguma dúvida?`;
      case "w3":
        return `${hello} Seu pedido de cotação continua com a gente. Prefere que o especialista te ligue ou que siga por aqui?`;
      default:
        return `${hello} Seu pedido de cotação continua aberto. Posso ajudar?`;
    }
  })();
  return `${body}\n\n${SAIR_FOOTER}`;
}

/** Campo que falta, em forma de pedido curto ("a idade de quem vai usar o plano"). */
export function pendingAskFor(collectedFields: readonly string[]) {
  const done = new Set(collectedFields);
  const asks: Array<[string, string]> = [
    ["planType", "saber se o plano é só pra você, pra família ou pra empresa"],
    ["numberOfLives", "saber quantas pessoas vão entrar no plano"],
    ["age", "a idade de quem vai usar o plano"],
    ["city", "a cidade e o bairro onde você mora"],
  ];
  return asks.find(([key]) => !done.has(key))?.[1] ?? null;
}

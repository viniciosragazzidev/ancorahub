/**
 * Guardrails da venda (§7 do plano). Substituem o PricingGuard só aqui: preço pode, desde que seja
 * exatamente um valor do snapshot da cotação. Tudo puro e testado.
 */
import type { ManagerCallReason, OfferSnapshot } from "./contracts";
import { DEFAULT_AUTO_SALE_SETTINGS, type AutoSaleSettings } from "./settings";

const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

// ─── Dinheiro ────────────────────────────────────────────────────────────────

const MONEY_PATTERNS = [
  /r\$\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/gi,
  /(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(?:reais|real|conto|contos|pila)\b/gi,
  /(\d{1,3}(?:\.\d{3})*),(\d{2})\b/g,
  /(\d{1,3}(?:\.\d{3})+|\d{2,})(?:,(\d{1,2}))?\s*(?:por m[eê]s|\/m[eê]s|mensais|mensal|ao m[eê]s|por pessoa|por vida|cada)/gi,
];
/** "1,2 mil", "2 mil" por mês. */
const THOUSANDS = /(\d+)(?:,(\d))?\s*mil\b/gi;
/** Porcentagem é sempre promoção ou desconto: só com promoção vigente. */
const PERCENT = /\d+\s*(%|por cento)/i;

/** Todos os valores em reais citados no texto, em centavos (sem repetir). */
export function extractMoneyCents(text: string): number[] {
  const found = new Set<number>();
  for (const pattern of MONEY_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const integer = Number(match[1].replace(/\./g, ""));
      const decimals = match[2] ? Number(match[2].padEnd(2, "0")) : 0;
      if (Number.isFinite(integer)) found.add(integer * 100 + decimals);
    }
  }
  for (const match of text.matchAll(THOUSANDS)) {
    found.add((Number(match[1]) * 1000 + Number(match[2] ?? 0) * 100) * 100);
  }
  return [...found];
}

/**
 * Valores que o agente pode citar: totais e por vida da oferta VIGENTE, a diferença para a anterior,
 * e os valores que o próprio cliente informou (o que paga hoje, o orçamento), só para repetir.
 */
export function allowedMoneyFromOffers(offers: readonly OfferSnapshot[], customerValues: readonly number[] = []): Set<number> {
  const allowed = new Set<number>(customerValues);
  const current = offers.at(-1);
  if (current) {
    for (const plan of current.plans) {
      allowed.add(plan.totalCents);
      for (const life of plan.perLife) allowed.add(life.cents);
    }
    const cheapest = current.plans[0]?.totalCents;
    if (cheapest != null && current.previousTotalCents != null && current.previousTotalCents > cheapest) {
      allowed.add(current.previousTotalCents);
      allowed.add(current.previousTotalCents - cheapest);
    }
  }
  return allowed;
}

/** Um valor citado bate? Aceita o valor em reais inteiros ("R$ 450" para 450,37), nunca outro. */
function isAllowedMoney(cents: number, allowed: ReadonlySet<number>) {
  if (allowed.has(cents)) return true;
  if (cents % 100 !== 0) return false;
  for (const value of allowed) if (Math.floor(value / 100) * 100 === cents || Math.round(value / 100) * 100 === cents) return true;
  return false;
}

// ─── Saída do agente ─────────────────────────────────────────────────────────

export type GuardViolation =
  | { rule: "price_not_in_snapshot"; value: number }
  | { rule: "promotion_without_table" }
  | { rule: "network_without_source" }
  | { rule: "forbidden_promise"; match: string }
  | { rule: "medical_advice"; match: string }
  | { rule: "too_long" }
  | { rule: "too_many_messages" }
  | { rule: "empty" };

const FORBIDDEN_PROMISES = [
  /sem car[eê]ncia/i, /car[eê]ncia zero/i, /aprova[cç][aã]o garantida/i, /garanto (que )?(a )?aprova/i, /cobre tudo/i,
  /cobertura total/i, /(e|é) aprovado com certeza/i, /consigo (te )?(reduzir|baixar|um desconto)/i, /n[aã]o tem reajuste/i,
];
const MEDICAL_ADVICE = [/voc[eê] (deve|deveria) (tomar|fazer|procurar)/i, /(diagn[oó]stic|receit)[a-z]*/i, /(tome|use) (o |a )?rem[eé]dio/i];
const PROMOTION_WORDS = /(promo[cç][aã]o|desconto|gr[aá]tis|sem custo|de brinde|primeira mensalidade)/i;
const NETWORK_CLAIMS = /(atende no|tem o hospital|hospital .{0,40} (est[aá]|faz parte)|rede (inclui|tem)|credenciad)/i;

export type OutgoingContext = {
  allowedMoney: ReadonlySet<number>;
  hasActivePromotion: boolean;
  networkSourced: boolean;
};

/** Troca travessões por vírgula (texto do Lite sem travessão) e corta espaços. */
export function sanitizeMessage(text: string) {
  return text.replace(/\s*[\u2014\u2013]\s*/g, ", ").replace(/\s+/g, " ").trim();
}

export function checkOutgoingMessages(messages: readonly string[], context: OutgoingContext): GuardViolation[] {
  const violations: GuardViolation[] = [];
  if (!messages.length || messages.every((message) => !message.trim())) return [{ rule: "empty" }];
  if (messages.length > 4) violations.push({ rule: "too_many_messages" });
  for (const message of messages) {
    if (message.length > 400) violations.push({ rule: "too_long" });
    for (const value of extractMoneyCents(message)) {
      if (!isAllowedMoney(value, context.allowedMoney)) violations.push({ rule: "price_not_in_snapshot", value });
    }
    if (!context.hasActivePromotion && (PROMOTION_WORDS.test(message) || PERCENT.test(message))) violations.push({ rule: "promotion_without_table" });
    if (!context.networkSourced && NETWORK_CLAIMS.test(message)) violations.push({ rule: "network_without_source" });
    for (const pattern of FORBIDDEN_PROMISES) {
      const match = message.match(pattern);
      if (match) violations.push({ rule: "forbidden_promise", match: match[0] });
    }
    for (const pattern of MEDICAL_ADVICE) {
      const match = message.match(pattern);
      if (match) violations.push({ rule: "medical_advice", match: match[0] });
    }
  }
  return violations;
}

// ─── Entrada do cliente ──────────────────────────────────────────────────────

export type InboundSignal = { stop: "opt_out" | null; callManager: ManagerCallReason | null; injection: boolean };

/**
 * Opt-out da venda: mais estreito que o `parseOptOut` da qualificação, que trata "não quero" e "já tenho"
 * como saída. Numa negociação "não quero coparticipação" é preferência, não opt-out.
 */
const OPT_OUT_EXACT = /^(sair|parar|stop|remover|descadastrar|cancelar mensagens|pare de enviar( mensagens)?|nao me mande( mais)? mensage(m|ns)|nao tenho (mais )?interesse|sem interesse|nao quero mais|pode encerrar)[.! ]*$/;
const OPT_OUT_ANYWHERE = /(nao tenho (mais )?interesse|nao quero mais (receber|mensagens|nada)|para de me mandar|pare de me mandar|(fechei|contratei) com outr|me tire da lista|nao me procure)/;
const HUMAN = /(falar com (uma |um |alguem|algu[eé]m|a )?(pessoa|atendente|humano|corretor|corretora|gente de verdade|vendedor)|quero (um|uma) (atendente|pessoa|humano)|voce e (um )?robo|e (um )?robo\b|nao quero falar com robo)/;
const LEGAL = /(advogad|procon|reclame aqui|processar|processo judicial|justica|anatel|\bans\b.{0,20}(denunci|reclam))/;
const IRRITATION = /(que saco|para de (me )?encher|chato|absurdo|palhacada|ridiculo|vsf|porra|caralho|merda|vai se f|desrespeito|toda hora mensagem)/;
const SCAM = /(golpe|fraude|e confiavel|eh confiavel|e verdade isso|como sei que (e|eh) real|picaret)/;
// Dúvida comum de carência ("e se eu engravidar?", "cirurgia tem carência?") o playbook responde; aqui só doença e tratamento.
const HEALTH = /(doenca|diabet|cancer|pre.?existente|hipertens|depress|autis|quimio|hemodial|transplant|internad|cardiac|avc|em tratamento|faco tratamento|tenho (uma )?(doenca|problema de saude))/;
const INJECTION = /(ignore (as|todas|suas|a)|esqueca (as|suas) (regras|instrucoes)|system prompt|prompt do sistema|instrucoes (do|de) sistema|voce e um modelo|aja como|finja que|developer mode|modo desenvolvedor|repita (suas|as) instrucoes)/;

export function classifyInbound(text: string | null | undefined): InboundSignal {
  const value = fold(text ?? "").replace(/\s+/g, " ").trim();
  const signal: InboundSignal = { stop: null, callManager: null, injection: INJECTION.test(value) };
  if (!value) return signal;
  if (OPT_OUT_EXACT.test(value) || OPT_OUT_ANYWHERE.test(value)) return { ...signal, stop: "opt_out" };
  if (LEGAL.test(value)) return { ...signal, callManager: "legal_threat" };
  if (HUMAN.test(value)) return { ...signal, callManager: "asked_human" };
  if (IRRITATION.test(value)) return { ...signal, callManager: "irritation" };
  if (SCAM.test(value)) return { ...signal, callManager: "scam_suspicion" };
  if (HEALTH.test(value)) return { ...signal, callManager: "health_question" };
  return signal;
}

// ─── Ritmo e horário ─────────────────────────────────────────────────────────

/** Ainda cabe mais uma mensagem? D11: 6 por hora e 25 por dia por negociação. */
export function withinRateLimits(sentAt: readonly Date[], now: Date, pending = 1, limits: Pick<AutoSaleSettings, "messagesPerHour" | "messagesPerDay"> = DEFAULT_AUTO_SALE_SETTINGS) {
  const hour = sentAt.filter((at) => now.getTime() - at.getTime() < 3_600_000).length;
  const day = sentAt.filter((at) => now.getTime() - at.getTime() < 86_400_000).length;
  return hour + pending <= limits.messagesPerHour && day + pending <= limits.messagesPerDay;
}

const SP_PARTS = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function saoPauloParts(date: Date) {
  const parts = Object.fromEntries(SP_PARTS.formatToParts(date).map((part) => [part.type, part.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { weekday, hour: Number(parts.hour), minute: Number(parts.minute) };
}

/** D3: dias úteis das 8h às 21h em São Paulo. */
type SendWindow = Pick<AutoSaleSettings, "sendStartHour" | "sendEndHour">;

export function isWithinSendWindow(date: Date, window: SendWindow = DEFAULT_AUTO_SALE_SETTINGS) {
  const { weekday, hour } = saoPauloParts(date);
  return weekday >= 1 && weekday <= 5 && hour >= window.sendStartHour && hour < window.sendEndHour;
}

/** Cliente escreveu há pouco: responder é conversa, não mensagem fria (13/11, caso Katia às 06:50). */
export const CUSTOMER_REPLY_GRACE_MS = 30 * 60_000;

export function customerJustWrote(lastCustomerMessageAt: Date | null | undefined, now: Date) {
  if (!lastCustomerMessageAt) return false;
  const elapsed = now.getTime() - lastCustomerMessageAt.getTime();
  return elapsed >= -60_000 && elapsed <= CUSTOMER_REPLY_GRACE_MS;
}

/** Pode falar agora: dentro do horário de envio ou respondendo a quem acabou de escrever (follow-up segue o horário). */
export function canSpeakNow(now: Date, window: SendWindow, lastCustomerMessageAt: Date | null | undefined) {
  return isWithinSendWindow(now, window) || customerJustWrote(lastCustomerMessageAt, now);
}

/** Próximo instante dentro da janela de envio (ele mesmo, se já estiver dentro). */
export function nextSendWindowStart(date: Date, window: SendWindow = DEFAULT_AUTO_SALE_SETTINGS) {
  if (isWithinSendWindow(date, window)) return date;
  const step = 15 * 60_000;
  let cursor = new Date(Math.ceil(date.getTime() / step) * step);
  for (let index = 0; index < 4 * 24 * 7; index += 1) {
    if (isWithinSendWindow(cursor, window)) return cursor;
    cursor = new Date(cursor.getTime() + step);
  }
  return cursor;
}

/**
 * Prioridade leve por tipo de plantão (decisão 2026-11-10, "Premium").
 *
 * Módulo PURO: sem banco e sem `server-only`, para que o ranking (domain.ts),
 * a escolha sob trava (received-in-day-core.ts) e a prévia da fila
 * (duty-queue-order.ts) usem exatamente a mesma regra.
 *
 * Ideia central: a "menor carga" deixa de ser só `recebidos no dia` e passa a
 * ser a carga efetiva `recebidos ÷ fator`, onde
 *   fator = peso do tipo do plantão (em milésimos, 1000 = peso 1)
 *         × minutos de plantão já cumpridos (só quando o nivelamento por horas
 *           está ligado; corrige a "rajada da tarde").
 * A comparação é feita por multiplicação cruzada de inteiros (a·fb vs b·fa),
 * sem divisão nem arredondamento, então empates continuam empates exatos.
 *
 * Sem fator (undefined) a comparação é `a − b`, idêntica à regra anterior:
 * modo off, flag desligada ou nada a diferenciar = comportamento byte-idêntico.
 */

export type PlantaoPriorityMode = "off" | "shadow" | "on";
export type PlantaoPriorityTemperature = "hot" | "warm";

export type PlantaoPriorityTypeConfig = {
  /** Peso base do tipo (1,0 a 1,3). 1 = sem prioridade. */
  base: number;
  /** Peso adaptativo pela taxa de venda de 30 dias (desligado por padrão). */
  adaptive: boolean;
};

/** Último cálculo do peso adaptativo de um tipo, recalculado no máximo 1x por dia. */
export type PlantaoAdaptiveComputed = {
  /** Dia (YYYY-MM-DD, São Paulo) do cálculo. */
  date: string;
  w: number;
  sales: number;
  leads: number;
  reason: AdaptiveWeightReason;
};

export type PlantaoPrioritySettings = {
  mode: PlantaoPriorityMode;
  temps: PlantaoPriorityTemperature[];
  /** Teto absoluto do peso (nunca acima de 1,3). */
  cap: number;
  /** Teto de fatia: fatia do tipo nas ofertas quentes/mornas do dia ≤ shareCap × fatia justa. */
  shareCap: number;
  /** Nivela por leads ÷ horas de plantão cumpridas (rajada da tarde). Só no modo "on". */
  levelByHours: boolean;
  types: Record<string, PlantaoPriorityTypeConfig>;
  computed: Record<string, PlantaoAdaptiveComputed>;
};

export const PLANTAO_WEIGHT_MIN = 1;
export const PLANTAO_WEIGHT_MAX = 1.3;
/** Escala inteira do peso: 1,15 vira 1150. */
export const PLANTAO_WEIGHT_SCALE = 1000;
/** Abaixo disso o plantão conta como 1 hora cumprida (evita dividir por quase zero na abertura). */
export const PLANTAO_MIN_ELAPSED_MINUTES = 60;
/** Taxa de expiração do tipo nas últimas 2 horas acima da qual o peso volta a 1. */
export const PLANTAO_EXPIRY_GUARD_RATE = 0.12;
export const PLANTAO_EXPIRY_GUARD_WINDOW_MINUTES = 120;
/** O teto de fatia só vale com uma amostra mínima de ofertas no dia (no início do dia a fatia oscila demais). */
export const PLANTAO_SHARE_MIN_SAMPLE = 20;

export const DEFAULT_PLANTAO_PRIORITY_SETTINGS: PlantaoPrioritySettings = {
  mode: "off",
  temps: ["hot", "warm"],
  cap: PLANTAO_WEIGHT_MAX,
  shareCap: 1.3,
  levelByHours: true,
  types: {},
  computed: {},
};

/** Chave por empresa em system_settings (sem migração), como ddd_routing_<tenant>. */
export function plantaoPrioritySettingKey(tenantId: string) {
  return `plantao_priority_${tenantId}`;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Trava o peso em [1,0; min(cap, 1,3)] com 3 casas (a escala inteira). */
export function clampPlantaoWeight(value: number, cap: number = PLANTAO_WEIGHT_MAX) {
  const top = Math.min(PLANTAO_WEIGHT_MAX, Math.max(PLANTAO_WEIGHT_MIN, Number.isFinite(cap) ? cap : PLANTAO_WEIGHT_MAX));
  const bounded = Math.min(top, Math.max(PLANTAO_WEIGHT_MIN, Number.isFinite(value) ? value : PLANTAO_WEIGHT_MIN));
  return Math.round(bounded * PLANTAO_WEIGHT_SCALE) / PLANTAO_WEIGHT_SCALE;
}

export function plantaoWeightToScaled(weight: number, cap?: number) {
  return Math.round(clampPlantaoWeight(weight, cap) * PLANTAO_WEIGHT_SCALE);
}

/** Lê o JSON gravado; qualquer valor inválido cai no padrão (modo off). */
export function normalizePlantaoPrioritySettings(value: unknown): PlantaoPrioritySettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_PLANTAO_PRIORITY_SETTINGS;
  const raw = value as Record<string, unknown>;
  const mode: PlantaoPriorityMode = raw.mode === "shadow" || raw.mode === "on" ? raw.mode : "off";
  const temps = Array.isArray(raw.temps)
    ? [...new Set(raw.temps.filter((item): item is PlantaoPriorityTemperature => item === "hot" || item === "warm"))]
    : DEFAULT_PLANTAO_PRIORITY_SETTINGS.temps;
  const cap = clampPlantaoWeight(finiteNumber(raw.cap) ?? PLANTAO_WEIGHT_MAX);
  const shareCapRaw = finiteNumber(raw.shareCap);
  const shareCap = shareCapRaw === null ? DEFAULT_PLANTAO_PRIORITY_SETTINGS.shareCap : Math.min(3, Math.max(1, shareCapRaw));
  const types: Record<string, PlantaoPriorityTypeConfig> = {};
  if (raw.types && typeof raw.types === "object" && !Array.isArray(raw.types)) {
    for (const [typeId, config] of Object.entries(raw.types as Record<string, unknown>)) {
      if (!typeId || !config || typeof config !== "object") continue;
      const entry = config as Record<string, unknown>;
      types[typeId] = { base: clampPlantaoWeight(finiteNumber(entry.base) ?? PLANTAO_WEIGHT_MIN, cap), adaptive: entry.adaptive === true };
    }
  }
  const computed: Record<string, PlantaoAdaptiveComputed> = {};
  if (raw.computed && typeof raw.computed === "object" && !Array.isArray(raw.computed)) {
    for (const [typeId, item] of Object.entries(raw.computed as Record<string, unknown>)) {
      if (!item || typeof item !== "object") continue;
      const entry = item as Record<string, unknown>;
      const w = finiteNumber(entry.w);
      if (typeof entry.date !== "string" || w === null) continue;
      computed[typeId] = {
        date: entry.date,
        w: clampPlantaoWeight(w, cap),
        sales: finiteNumber(entry.sales) ?? 0,
        leads: finiteNumber(entry.leads) ?? 0,
        reason: isAdaptiveReason(entry.reason) ? entry.reason : "amostra_insuficiente",
      };
    }
  }
  return { mode, temps, cap, shareCap, levelByHours: raw.levelByHours !== false, types, computed };
}

// ─── Comparação da carga efetiva (a mesma nos três caminhos) ────────────────

/**
 * Negativo quando A está menos carregado que B. Com os dois fatores definidos:
 * recebidosA ÷ fatorA vs recebidosB ÷ fatorB, por multiplicação cruzada.
 * Sem fator: `a − b`, exatamente a regra anterior.
 */
export function compareEffectiveLoad(aReceived: number, aFactor: number | undefined, bReceived: number, bFactor: number | undefined): number {
  if (aFactor === undefined || bFactor === undefined) return aReceived - bReceived;
  return aReceived * bFactor - bReceived * aFactor;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}

/** Chave de empate da carga efetiva (fração reduzida), usada pela prévia da fila. */
export function effectiveLoadKey(received: number, factor: number | undefined) {
  if (factor === undefined) return String(received);
  const divisor = gcd(received, factor) || 1;
  return `${received / divisor}/${factor / divisor}`;
}

/** Minutos de plantão já cumpridos desde o início da ocorrência (ou do dia da operação, se depois). */
export function elapsedDutyMinutes(occurrenceStartsAt: Date, since: Date, now: Date) {
  const start = Math.max(occurrenceStartsAt.getTime(), since.getTime());
  return Math.max(PLANTAO_MIN_ELAPSED_MINUTES, Math.floor((now.getTime() - start) / 60_000));
}

/**
 * Fator de cada corretor = peso do tipo do plantão dele × minutos cumpridos.
 * Sem minutos para algum corretor, o nivelamento por horas sai para o grupo inteiro
 * (misturar taxa e contagem quebraria a ordem). Retorna null quando todos os fatores
 * são iguais: aí nada muda e o chamador segue pelo caminho antigo.
 */
export function buildPlantaoLoadFactors(input: {
  brokerIds: readonly string[];
  scheduleIdByBroker: Readonly<Record<string, string | null | undefined>>;
  weightScaledBySchedule: Readonly<Record<string, number>>;
  elapsedMinutesBySchedule?: Readonly<Record<string, number>> | null;
}): Record<string, number> | null {
  if (!input.brokerIds.length) return null;
  const elapsed = input.elapsedMinutesBySchedule
    && input.brokerIds.every((id) => {
      const scheduleId = input.scheduleIdByBroker[id];
      return Boolean(scheduleId && Number.isInteger(input.elapsedMinutesBySchedule![scheduleId]) && input.elapsedMinutesBySchedule![scheduleId] > 0);
    })
    ? input.elapsedMinutesBySchedule
    : null;
  const factors: Record<string, number> = {};
  for (const id of input.brokerIds) {
    const scheduleId = input.scheduleIdByBroker[id];
    const weight = scheduleId ? input.weightScaledBySchedule[scheduleId] ?? PLANTAO_WEIGHT_SCALE : PLANTAO_WEIGHT_SCALE;
    factors[id] = weight * (elapsed && scheduleId ? elapsed[scheduleId] : 1);
  }
  const values = Object.values(factors);
  return values.every((value) => value === values[0]) ? null : factors;
}

// ─── Peso efetivo de um tipo agora ───────────────────────────────────────────

export type PlantaoWeightReason =
  | "temperatura_fora"
  | "sem_peso"
  | "peso_base"
  | "peso_adaptativo"
  | "teto_de_fatia"
  | "expiracao_alta";

export const PLANTAO_WEIGHT_REASON_LABEL: Record<PlantaoWeightReason, string> = {
  temperatura_fora: "Lead frio ou sem temperatura: peso 1.",
  sem_peso: "Tipo sem prioridade configurada.",
  peso_base: "Peso base em uso.",
  peso_adaptativo: "Peso adaptativo (taxa de venda de 30 dias).",
  teto_de_fatia: "Fatia do dia acima do teto: peso volta a 1.",
  expiracao_alta: "Expiração acima de 12% nas últimas 2 horas: peso volta a 1.",
};

export type PlantaoShareStats = {
  /** Ofertas quentes/mornas do dia em plantões deste tipo (no escopo da escolha). */
  typeOffers: number;
  /** Ofertas quentes/mornas do dia em todos os plantões do escopo. */
  totalOffers: number;
  /** Corretores escalados ativos deste tipo agora. */
  typeBrokers: number;
  /** Corretores escalados ativos (todos os tipos) agora. */
  totalBrokers: number;
};

export type PlantaoExpiryStats = { expired: number; resolved: number };

export function isPlantaoShareCapExceeded(share: PlantaoShareStats | null | undefined, shareCap: number) {
  if (!share || share.totalOffers < PLANTAO_SHARE_MIN_SAMPLE || share.totalBrokers <= 0 || share.typeBrokers <= 0) return false;
  // fatia = typeOffers/totalOffers; justa = typeBrokers/totalBrokers; excede se fatia > shareCap × justa.
  return share.typeOffers * share.totalBrokers > shareCap * share.typeBrokers * share.totalOffers;
}

export function isPlantaoExpiryGuardTripped(expiry: PlantaoExpiryStats | null | undefined) {
  return Boolean(expiry && expiry.resolved > 0 && expiry.expired > PLANTAO_EXPIRY_GUARD_RATE * expiry.resolved);
}

export function resolvePlantaoTypeWeight(input: {
  base: number;
  /** Peso adaptativo do dia, quando o tipo usa o adaptativo e já há cálculo. */
  adaptiveWeight?: number | null;
  cap: number;
  temperature: string | null | undefined;
  temps: readonly string[];
  shareCap: number;
  share?: PlantaoShareStats | null;
  expiry?: PlantaoExpiryStats | null;
}): { w: number; reason: PlantaoWeightReason } {
  // O peso só vale para lead quente e morno; frio (ou sem temperatura) sempre 1.
  if (!input.temperature || input.temperature === "cold" || !input.temps.includes(input.temperature)) return { w: 1, reason: "temperatura_fora" };
  const adaptive = input.adaptiveWeight !== undefined && input.adaptiveWeight !== null;
  const w = clampPlantaoWeight(adaptive ? input.adaptiveWeight! : input.base, input.cap);
  if (w <= PLANTAO_WEIGHT_MIN) return { w: 1, reason: "sem_peso" };
  if (isPlantaoExpiryGuardTripped(input.expiry)) return { w: 1, reason: "expiracao_alta" };
  if (isPlantaoShareCapExceeded(input.share, input.shareCap)) return { w: 1, reason: "teto_de_fatia" };
  return { w, reason: adaptive ? "peso_adaptativo" : "peso_base" };
}

// ─── Peso adaptativo (pronto, desligado por padrão) ──────────────────────────

export const ADAPTIVE_ALPHA = 200;
export const ADAPTIVE_MIN_LEADS = 150;
export const ADAPTIVE_MIN_SALES = 30;
export const ADAPTIVE_MAX_DAILY_STEP = 0.05;
export const ADAPTIVE_WINDOW_DAYS = 30;

export type AdaptiveWeightReason = "amostra_insuficiente" | "calculado";

function isAdaptiveReason(value: unknown): value is AdaptiveWeightReason {
  return value === "amostra_insuficiente" || value === "calculado";
}

/**
 * Taxa de venda do tipo em 30 dias com encolhimento para a média global
 * r̂ = (s + α·r_global) / (n + α), alvo w = clamp(1 + 0,5·(r̂/r_global − 1), 1,0, 1,3),
 * andando no máximo ±0,05 por dia a partir do peso anterior.
 * Sem amostra mínima (n ≥ 150 e ≥ 30 vendas) o peso anterior fica como está.
 */
export function computeAdaptiveWeight(input: {
  sales: number;
  leads: number;
  globalSales: number;
  globalLeads: number;
  previous: number;
  cap?: number;
}): { w: number; reason: AdaptiveWeightReason; shrunkRate: number | null; target: number | null } {
  const cap = input.cap ?? PLANTAO_WEIGHT_MAX;
  const previous = clampPlantaoWeight(input.previous, cap);
  if (input.leads < ADAPTIVE_MIN_LEADS || input.sales < ADAPTIVE_MIN_SALES || input.globalLeads <= 0 || input.globalSales <= 0) {
    return { w: previous, reason: "amostra_insuficiente", shrunkRate: null, target: null };
  }
  const globalRate = input.globalSales / input.globalLeads;
  const shrunkRate = (input.sales + ADAPTIVE_ALPHA * globalRate) / (input.leads + ADAPTIVE_ALPHA);
  const target = clampPlantaoWeight(1 + 0.5 * (shrunkRate / globalRate - 1), cap);
  const step = Math.max(-ADAPTIVE_MAX_DAILY_STEP, Math.min(ADAPTIVE_MAX_DAILY_STEP, target - previous));
  return { w: clampPlantaoWeight(previous + step, cap), reason: "calculado", shrunkRate, target };
}

// ─── Decisão levada até a oferta e registro no offer_sent ───────────────────

export type PlantaoPriorityDecision = {
  mode: Exclude<PlantaoPriorityMode, "off">;
  /** null = nenhum fator diferente: a escolha ponderada é igual à de hoje. */
  factorByBroker: Record<string, number> | null;
  scheduleIdByBroker: Record<string, string>;
  weightBySchedule: Record<string, number>;
  reasonBySchedule: Record<string, PlantaoWeightReason>;
  typeIdBySchedule: Record<string, string | null>;
  hoursLeveling: boolean;
};

export type PlantaoPriorityOfferInput = PlantaoPriorityDecision & {
  /** Primeiro da escolha de hoje (sem peso) e da ponderada, no pré-ranking. */
  baselineFirstBrokerId: string | null;
  weightedFirstBrokerId: string | null;
};

export type PlantaoPriorityOfferMetadata = {
  mode: Exclude<PlantaoPriorityMode, "off">;
  w: number;
  chosenScheduleId: string | null;
  baselineScheduleId: string | null;
  chosenTypeId: string | null;
  baselineTypeId: string | null;
  changed: boolean;
  reason: PlantaoWeightReason | null;
  hoursLeveling: boolean;
};

/**
 * O que vai no metadata do offer_sent. `chosen` é a escolha ponderada (a real no
 * modo on; a hipotética no modo sombra); `baseline` é a escolha de hoje.
 */
export function buildPlantaoPriorityOfferMetadata(input: {
  decision: PlantaoPriorityDecision;
  offeredBrokerId: string;
  baselineBrokerId: string | null;
  weightedBrokerId: string | null;
}): PlantaoPriorityOfferMetadata {
  const { decision } = input;
  const scheduleOf = (id: string | null) => (id ? decision.scheduleIdByBroker[id] ?? null : null);
  const offeredSchedule = scheduleOf(input.offeredBrokerId);
  const chosenScheduleId = decision.mode === "on" ? offeredSchedule : scheduleOf(input.weightedBrokerId);
  const baselineScheduleId = decision.mode === "on" ? scheduleOf(input.baselineBrokerId) : offeredSchedule;
  return {
    mode: decision.mode,
    w: chosenScheduleId ? decision.weightBySchedule[chosenScheduleId] ?? 1 : 1,
    chosenScheduleId,
    baselineScheduleId,
    chosenTypeId: chosenScheduleId ? decision.typeIdBySchedule[chosenScheduleId] ?? null : null,
    baselineTypeId: baselineScheduleId ? decision.typeIdBySchedule[baselineScheduleId] ?? null : null,
    changed: chosenScheduleId !== baselineScheduleId,
    reason: chosenScheduleId ? decision.reasonBySchedule[chosenScheduleId] ?? null : null,
    hoursLeveling: decision.hoursLeveling,
  };
}

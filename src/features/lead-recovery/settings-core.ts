/**
 * Configuração da recuperação de leads por empresa (plano §8.4). Tudo nasce DESLIGADO: o diretor liga em
 * /qualificacao/turbo › Recuperação. Pura (lida e validada aqui; gravada como system setting, sem migration).
 * Plano: docs/implementations/active/2026-11-21-recuperacao-de-leads.md
 */

export type RecoveryChannelSetting = "meta" | "waha" | "same";

/** Passos da cadência única (§5.1). T1–T4 seguem no turbo; aqui ficam os novos. */
export type RecoveryStepId = "s2" | "s3" | "s4" | "s5" | "s6" | "w2" | "w3" | "n1" | "n2" | "n3";

export type RecoveryStepSetting = { enabled: boolean; channel: RecoveryChannelSetting };

export type RecoverySettings = {
  /** Interruptor geral da cadência única (fase 3). */
  enabled: boolean;
  /** Segmentos (fase 3: parou no meio e morno; fase 5: nutrição). */
  stoppedMidway: boolean;
  warmBridge: boolean;
  nurture: boolean;
  /** Fila "Sem resposta" trabalhada pelo Call Âncora (fase 4). */
  callQueue: boolean;
  /** Pontuação perfil × interesse ordena a fila (fase 4). */
  scoring: boolean;
  /** Thompson por passo (fase 5). */
  stepExperiments: boolean;
  /** Grupo de controle (0 a 50%): recebe só o que existe hoje. */
  controlPct: number;
  /** Janela de envio (São Paulo). */
  sendStartHour: number;
  sendEndHour: number;
  /** Conferência jurídica (LGPD e telemarketing de SP e RJ) registrada pelo diretor: sem ela, nada da fase 3 sai. */
  legalReviewedAt: string | null;
  steps: Record<RecoveryStepId, RecoveryStepSetting>;
};

export const RECOVERY_STEP_IDS: readonly RecoveryStepId[] = ["s2", "s3", "s4", "s5", "s6", "w2", "w3", "n1", "n2", "n3"];

export const DEFAULT_RECOVERY_SETTINGS: RecoverySettings = {
  enabled: false,
  stoppedMidway: false,
  warmBridge: false,
  nurture: false,
  callQueue: false,
  scoring: false,
  stepExperiments: false,
  controlPct: 10,
  sendStartHour: 8,
  sendEndHour: 20,
  legalReviewedAt: null,
  steps: {
    // Texto livre dentro da janela de 24 h: o canal da conversa (com o outro como reserva).
    s2: { enabled: true, channel: "same" },
    s3: { enabled: true, channel: "same" },
    // Fora da janela: só template aprovado, só Meta oficial.
    s4: { enabled: true, channel: "meta" },
    s5: { enabled: true, channel: "meta" },
    s6: { enabled: true, channel: "meta" },
    // Ponte do morno sem contato do corretor (texto livre na janela).
    w2: { enabled: true, channel: "same" },
    w3: { enabled: true, channel: "same" },
    // Nutrição mensal: template de marketing.
    n1: { enabled: true, channel: "meta" },
    n2: { enabled: true, channel: "meta" },
    n3: { enabled: true, channel: "meta" },
  },
};

const CHANNELS: readonly RecoveryChannelSetting[] = ["meta", "waha", "same"];

function hour(value: unknown, fallback: number) {
  const number = typeof value === "number" ? Math.round(value) : NaN;
  return Number.isFinite(number) && number >= 0 && number <= 23 ? number : fallback;
}

export function parseRecoverySettings(raw: string | null | undefined): RecoverySettings {
  if (!raw) return structuredClone(DEFAULT_RECOVERY_SETTINGS);
  let value: Partial<RecoverySettings>;
  try {
    value = JSON.parse(raw) as Partial<RecoverySettings>;
  } catch {
    return structuredClone(DEFAULT_RECOVERY_SETTINGS);
  }
  const steps = { ...DEFAULT_RECOVERY_SETTINGS.steps };
  for (const id of RECOVERY_STEP_IDS) {
    const step = value.steps?.[id];
    if (!step) continue;
    // Template (fora da janela) nunca sai por WAHA: o passo de template fica sempre na Meta.
    const templateStep = id === "s4" || id === "s5" || id === "s6" || id.startsWith("n");
    const channel = CHANNELS.includes(step.channel) ? step.channel : steps[id].channel;
    steps[id] = { enabled: step.enabled !== false, channel: templateStep ? "meta" : channel };
  }
  const start = hour(value.sendStartHour, DEFAULT_RECOVERY_SETTINGS.sendStartHour);
  const end = hour(value.sendEndHour, DEFAULT_RECOVERY_SETTINGS.sendEndHour);
  const pct = typeof value.controlPct === "number" ? Math.round(value.controlPct) : DEFAULT_RECOVERY_SETTINGS.controlPct;
  return {
    enabled: value.enabled === true,
    stoppedMidway: value.stoppedMidway === true,
    warmBridge: value.warmBridge === true,
    nurture: value.nurture === true,
    callQueue: value.callQueue === true,
    scoring: value.scoring === true,
    stepExperiments: value.stepExperiments === true,
    controlPct: Math.min(50, Math.max(0, Number.isFinite(pct) ? pct : 10)),
    sendStartHour: start < end ? start : DEFAULT_RECOVERY_SETTINGS.sendStartHour,
    sendEndHour: start < end ? end : DEFAULT_RECOVERY_SETTINGS.sendEndHour,
    legalReviewedAt: typeof value.legalReviewedAt === "string" ? value.legalReviewedAt : null,
    steps,
  };
}

/** O que falta para a cadência nova sair (texto para a tela). Vazio = pode sair. */
export function recoveryBlockers(settings: RecoverySettings): string[] {
  const out: string[] = [];
  if (!settings.enabled) out.push("A recuperação está desligada.");
  if (!settings.legalReviewedAt) out.push("Falta registrar a conferência jurídica (LGPD e telemarketing de SP e RJ).");
  return out;
}

/** Bucket estável 0–99 por lead (FNV-1a), o mesmo no job, na tela e no SQL de apoio. */
export function recoveryBucket(leadId: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < leadId.length; index += 1) {
    hash ^= leadId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 100;
}

/** Grupo de controle fixo por lead: recebe só o que existe hoje (turbo e follow-up de silêncio). */
export function isRecoveryControl(leadId: string, controlPct: number) {
  return recoveryBucket(leadId) < Math.max(0, Math.min(50, controlPct));
}

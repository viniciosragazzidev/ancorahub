/**
 * Núcleo puro do padrão de feedback (docs/design-system/FEEDBACK.md): decide quais camadas
 * disparam para um tipo de feedback, conforme as preferências e o limite diário de celebrações.
 * Sem React e sem DOM, para testar.
 */
import { motionTokens } from "@/components/arc/motion-tokens";

import { FEEDBACK_KINDS, feedbackTokens, type FeedbackHaptic, type FeedbackKind, type FeedbackSound } from "./tokens";

export type FeedbackPrefs = {
  sound: boolean;
  haptic: boolean;
  /** Falso com "Menos animação", `prefers-reduced-motion` ou o kill-switch. */
  motion: boolean;
  celebrations: boolean;
};

export type FeedbackOptions = {
  /** Toca o som de confirmação no nível 1 (só em ação ocasional; ação de dezenas por dia fica sem som). */
  sound?: boolean;
  /** Chave do limite diário no nível 2 (ex.: "meta-do-dia"). Padrão: o próprio tipo. */
  budgetKey?: string;
};

export type FeedbackPlan = {
  kind: FeedbackKind;
  /** Nível efetivo depois das preferências e do limite (um nível 2 ou 3 negado cai para 1). */
  level: 0 | 1 | 2 | 3 | "event";
  sound: FeedbackSound | null;
  haptic: readonly number[] | null;
  /** O componente pode animar (deslocamento, escala). Sem isso, só troca direta ou fade curto. */
  motion: boolean;
  /** O componente pode mostrar a celebração (anel, mascote comemorando, overlay). */
  celebrate: boolean;
};

/** Contador do dia: `take` consome uma vaga e diz se ainda havia. */
export type CelebrationBudget = { take: (level: 2 | 3, key: string) => boolean };

export const unlimitedBudget: CelebrationBudget = { take: () => true };

function hapticOf(name: FeedbackHaptic | undefined, prefs: FeedbackPrefs) {
  return name && prefs.haptic ? feedbackTokens.haptic[name] : null;
}

export function planFeedback(kind: FeedbackKind, prefs: FeedbackPrefs, options: FeedbackOptions = {}, budget: CelebrationBudget = unlimitedBudget): FeedbackPlan {
  const spec = FEEDBACK_KINDS[kind];
  const level = spec.level;

  if (level === 2 || level === 3) {
    const allowed = prefs.celebrations && budget.take(level, options.budgetKey ?? kind);
    if (!allowed) {
      // Celebração desligada ou já usada hoje: vira confirmação (só o número muda), sem som de marco.
      return { kind, level: 1, sound: null, haptic: hapticOf("confirm", prefs), motion: prefs.motion, celebrate: false };
    }
    return {
      kind,
      level,
      sound: prefs.sound ? spec.sound ?? null : null,
      haptic: hapticOf(spec.haptic, prefs),
      motion: prefs.motion,
      // Com movimento reduzido o nível 3 vira o nível 1 na tela; som e vibração seguem os próprios interruptores.
      celebrate: prefs.motion,
    };
  }

  const wantsSound = spec.soundOptIn ? options.sound === true : true;
  return {
    kind,
    level,
    sound: prefs.sound && wantsSound ? spec.sound ?? null : null,
    haptic: hapticOf(spec.haptic, prefs),
    motion: prefs.motion,
    celebrate: false,
  };
}

/** Limite diário guardado num objeto simples (o hook persiste no aparelho). */
export type BudgetState = { day: string; counts: Record<string, number> };

export function takeFromBudget(state: BudgetState, today: string, level: 2 | 3, key: string): { allowed: boolean; next: BudgetState } {
  const current = state.day === today ? state : { day: today, counts: {} };
  const slot = level === 3 ? "nivel-3" : `nivel-2:${key}`;
  const used = current.counts[slot] ?? 0;
  const max = motionTokens.celebration.maxPerDay[level];
  if (used >= max) return { allowed: false, next: current };
  return { allowed: true, next: { day: today, counts: { ...current.counts, [slot]: used + 1 } } };
}

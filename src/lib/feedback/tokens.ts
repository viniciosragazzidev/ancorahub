/**
 * Tokens de som e vibração do padrão de feedback (docs/design-system/FEEDBACK.md §5).
 * Os tempos e curvas ficam em src/components/arc/motion-tokens.ts; aqui só o que não é movimento.
 */
export const feedbackTokens = {
  /** Receita de src/lib/sounds/recipes.ts e volume (0 a 1). */
  sound: {
    notify: { recipe: "notification", volume: 0.8 },
    confirm: { recipe: "tap", volume: 0.35 },
    milestone: { recipe: "milestone", volume: 0.6 },
    error: { recipe: "error", volume: 0.5 },
    warning: { recipe: "warning", volume: 0.5 },
  },
  /** Padrões da Vibration API, em ms (vibra, pausa, vibra). O iPhone ignora. */
  haptic: {
    tap: [10],
    confirm: [15],
    notify: [20, 60, 20],
    success: [12, 40, 24],
    error: [30, 50, 30],
  },
} as const;

export type FeedbackSound = keyof typeof feedbackTokens.sound;
export type FeedbackHaptic = keyof typeof feedbackTokens.haptic;
export type FeedbackLevel = 0 | 1 | 2 | 3;

/**
 * O que o app quer comunicar. Cada tipo tem um nível (§3) e as camadas que pode usar.
 * - tap: o toque foi sentido (pressão de um botão de nível 1 ou mais).
 * - confirm: nível 1, a ação foi confirmada pelo servidor. Som só quando a ação é ocasional (`sound: true`).
 * - milestone: nível 2, marco no contexto (meta do dia, missão).
 * - celebrate: nível 3, feito raro e verificado (venda, nível, marco de plantão).
 * - notify: evento que pede ação (lead novo).
 * - error: a ação falhou.
 * - warning: algo pede atenção, sem falha.
 */
export type FeedbackKind = "tap" | "confirm" | "milestone" | "celebrate" | "notify" | "error" | "warning";

export const FEEDBACK_KINDS: Record<FeedbackKind, { level: FeedbackLevel | "event"; sound?: FeedbackSound; haptic?: FeedbackHaptic; soundOptIn?: true }> = {
  tap: { level: 1, haptic: "tap" },
  confirm: { level: 1, haptic: "confirm", sound: "confirm", soundOptIn: true },
  milestone: { level: 2, haptic: "success", sound: "milestone" },
  celebrate: { level: 3, haptic: "success", sound: "milestone" },
  notify: { level: "event", haptic: "notify", sound: "notify" },
  error: { level: "event", haptic: "error", sound: "error" },
  warning: { level: "event", haptic: "tap", sound: "warning" },
};

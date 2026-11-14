"use client";

/**
 * Único ponto que toca som e vibra no app (docs/design-system/FEEDBACK.md §6).
 * `fireFeedback` serve fora do React (provedores, callbacks); `useFeedback` devolve a mesma função
 * já com o estado de movimento da interface. Nenhum outro código chama playSound ou navigator.vibrate.
 */
import { useCallback } from "react";

import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import { saoPauloDayKey } from "@/components/motion/first-time-today/first-time-today-core";
import { readA11yPrefs } from "@/features/assist/a11y-prefs";
import { playSound, type Patch } from "@/lib/sounds/player";
import { errorSound, milestoneSound, notificationSound, tapSound, warningSound } from "@/lib/sounds/recipes";

import { planFeedback, takeFromBudget, type BudgetState, type CelebrationBudget, type FeedbackOptions, type FeedbackPlan, type FeedbackPrefs } from "./core";
import { feedbackTokens, type FeedbackKind, type FeedbackSound } from "./tokens";

const RECIPES: Record<(typeof feedbackTokens.sound)[FeedbackSound]["recipe"], Patch> = {
  notification: notificationSound,
  tap: tapSound,
  milestone: milestoneSound,
  error: errorSound,
  warning: warningSound,
};

const BUDGET_KEY = "ancora:feedback-budget";
/** Se o aparelho não deixa gravar (aba anônima), o limite vale só nesta visita. */
let memoryBudget: BudgetState = { day: "", counts: {} };

function readBudget(): BudgetState {
  try {
    const raw = JSON.parse(window.localStorage.getItem(BUDGET_KEY) ?? "null") as BudgetState | null;
    if (raw && typeof raw.day === "string" && raw.counts && typeof raw.counts === "object") return raw;
  } catch { /* storage bloqueado */ }
  return memoryBudget;
}

function writeBudget(state: BudgetState) {
  memoryBudget = state;
  try { window.localStorage.setItem(BUDGET_KEY, JSON.stringify(state)); } catch { /* fica na memória */ }
}

const deviceBudget: CelebrationBudget = {
  take(level, key) {
    const { allowed, next } = takeFromBudget(readBudget(), saoPauloDayKey(new Date()), level, key);
    writeBudget(next);
    return allowed;
  },
};

/** Movimento da interface fora do React: kill-switch, "Menos animação" e a opção do sistema. */
function documentMotionEnabled() {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  if (root.dataset.interfaceMotion === "off" || root.dataset.reduceMotion === "1") return false;
  return !(typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function currentPrefs(motion: boolean): FeedbackPrefs {
  const prefs = readA11yPrefs();
  return { sound: prefs.sound, haptic: prefs.haptic, celebrations: prefs.celebrations, motion: motion && !prefs.reduceMotion };
}

/** Executa o plano: som e vibração. Falhas do navegador (sem gesto, sem API) nunca quebram a tela. */
function play(plan: FeedbackPlan) {
  if (plan.sound) {
    const { recipe, volume } = feedbackTokens.sound[plan.sound];
    try { playSound(RECIPES[recipe], { volume }); } catch { /* o navegador pode exigir um toque antes */ }
  }
  if (plan.haptic && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try { navigator.vibrate([...plan.haptic]); } catch { /* sem vibração neste aparelho */ }
  }
}

export function fireFeedback(kind: FeedbackKind, options?: FeedbackOptions, motion = documentMotionEnabled()): FeedbackPlan {
  if (typeof window === "undefined") return planFeedback(kind, { sound: false, haptic: false, motion: false, celebrations: false }, options);
  const plan = planFeedback(kind, currentPrefs(motion), options, deviceBudget);
  play(plan);
  return plan;
}

export function useFeedback() {
  const motion = useInterfaceMotionEnabled();
  return useCallback((kind: FeedbackKind, options?: FeedbackOptions) => fireFeedback(kind, options, motion), [motion]);
}

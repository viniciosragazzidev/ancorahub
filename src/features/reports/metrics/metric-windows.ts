import { getSaoPauloDayBounds } from "@/features/broker-workspace/workspace-data-domain";

/** Janelas do motor canônico: Hoje (dia de São Paulo), 7 e 30 dias móveis. */
export type CanonicalMetricWindowDays = 1 | 7 | 30;

export type CanonicalWindowBounds = {
  readonly current: { readonly startsAt: Date; readonly endsAt: Date };
  readonly previous: { readonly startsAt: Date; readonly endsAt: Date };
};

const DAY_MS = 86_400_000;

export function isCanonicalMetricWindow(value: unknown): value is CanonicalMetricWindowDays {
  return value === 1 || value === 7 || value === 30;
}

/**
 * 7 e 30 dias: janelas móveis iguais terminando agora, comparadas à janela imediatamente anterior.
 * Hoje: da meia-noite de São Paulo até agora, comparado a ontem no mesmo trecho do dia.
 */
export function canonicalWindowBounds(window: CanonicalMetricWindowDays, now: Date): CanonicalWindowBounds {
  if (window === 1) {
    const { start } = getSaoPauloDayBounds(now);
    return {
      current: { startsAt: start, endsAt: now },
      previous: { startsAt: new Date(start.getTime() - DAY_MS), endsAt: new Date(now.getTime() - DAY_MS) },
    };
  }
  const span = window * DAY_MS;
  return {
    current: { startsAt: new Date(now.getTime() - span), endsAt: now },
    previous: { startsAt: new Date(now.getTime() - 2 * span), endsAt: new Date(now.getTime() - span) },
  };
}

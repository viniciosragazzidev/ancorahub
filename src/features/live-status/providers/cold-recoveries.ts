import { businessTurnStart } from "@/features/dashboard/essential/business-window";

import type { LiveStatus } from "../types";

export type ColdRecoveriesAggregate = {
  attempted: number;
  recovered: number;
  warm: number;
  hot: number;
  lastRecoveredAt: Date | null;
};

export function coldRecoveryOperationDayStart(now: Date) {
  return businessTurnStart(now);
}

export function buildColdRecoveriesStatus(input: { aggregate: ColdRecoveriesAggregate; now: Date }): LiveStatus {
  const { aggregate, now } = input;
  const count = new Intl.NumberFormat("pt-BR");
  return {
    id: "frios-recuperados",
    label: "Frios recuperados",
    value: aggregate.recovered,
    emptyText: "Nenhum frio recuperado hoje",
    severity: aggregate.recovered ? "info" : "ok",
    lastEvent: aggregate.lastRecoveredAt
      ? { at: aggregate.lastRecoveredAt.toISOString(), label: "Última recuperação" }
      : undefined,
    explanation: `Pela qualificação, de ${count.format(aggregate.attempted)} frios tentados hoje.`,
    breakdown: aggregate.recovered
      ? [
          { label: "quentes", value: aggregate.hot },
          { label: "mornos", value: aggregate.warm },
        ]
      : undefined,
    generatedAt: now.toISOString(),
  };
}
